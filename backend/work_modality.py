"""Shared semantic work-modality prototypes and matching rules."""
from __future__ import annotations

from typing import Mapping, Sequence

import numpy as np

MODALITY_PROTOTYPES = {
    "remote": (
        "The job is fully remote or work from home. Employees work away from the employer's office. "
        "Equivalent work arrangements include remote work, telecommuting, telework, virtual, distributed, "
        "and working from anywhere. In Spanish: trabajo remoto, trabajar desde casa, teletrabajo, and trabajo a distancia."
    ),
    "on_site": (
        "The job is on-site at the employer's workplace. Employees commute to and work in person at an "
        "office, facility, store, or job site. Equivalent arrangements include onsite, in-office, office-based, "
        "in-person, and on-location work. In Spanish: trabajo presencial, en oficina, en el lugar de trabajo, and asistencia diaria al sitio."
    ),
    "hybrid": (
        "The job has a hybrid work arrangement, combining work from home or remote work with in-person "
        "days at an office or workplace. Employees split their time between home and the work site. "
        "In Spanish: modalidad híbrida, algunos días desde casa y otros días en la oficina."
    ),
}
MODALITY_IDS = tuple(MODALITY_PROTOTYPES)
QUERY_MODALITY_THRESHOLD = 0.30
QUERY_MODALITY_MARGIN = 0.02
JOB_MODALITY_THRESHOLD = 0.50


def cosine_scores(vector: Sequence[float], prototypes: Mapping[str, Sequence[float]]) -> dict[str, float]:
    vector_array = np.asarray(vector, dtype=np.float32)
    vector_norm = float(np.linalg.norm(vector_array))
    if vector_array.ndim != 1 or not np.isfinite(vector_norm) or vector_norm == 0:
        raise ValueError("Expected a finite non-zero modality vector.")
    normalized = vector_array / vector_norm
    scores = {}
    for modality, prototype in prototypes.items():
        prototype_array = np.asarray(prototype, dtype=np.float32)
        prototype_norm = float(np.linalg.norm(prototype_array))
        if prototype_array.shape != vector_array.shape or not np.isfinite(prototype_norm) or prototype_norm == 0:
            raise ValueError("Modality prototype vector is invalid.")
        scores[modality] = float(np.dot(normalized, prototype_array / prototype_norm))
    return scores


def infer_query_modalities(
    scores: Mapping[str, float],
    threshold: float = QUERY_MODALITY_THRESHOLD,
    margin: float = QUERY_MODALITY_MARGIN,
) -> set[str]:
    valid = {key: value for key, value in scores.items() if key in MODALITY_PROTOTYPES and np.isfinite(value)}
    if not valid:
        return set()
    best = max(valid.values())
    if best < threshold:
        return set()
    return {key for key, value in valid.items() if value >= threshold and best - value <= margin}


def _explicit_modality(value: str) -> str | None:
    normalized = " ".join(value.strip().lower().replace("_", " ").replace("-", " ").split())
    if normalized in {"remote", "fully remote", "remote work", "work from home", "wfh", "telework", "telecommute", "telecommuting", "distributed"}:
        return "remote"
    if normalized in {"on site", "onsite", "in person", "in office", "office based", "on location", "on premises"}:
        return "on_site"
    if normalized in {"hybrid", "hybrid remote", "hybrid work"}:
        return "hybrid"
    return None


def classify_job_modality(
    value: str,
    scores: Mapping[str, float],
    threshold: float = JOB_MODALITY_THRESHOLD,
) -> str:
    explicit = _explicit_modality(value) if isinstance(value, str) else None
    if explicit:
        return explicit
    valid = {key: score for key, score in scores.items() if key in MODALITY_PROTOTYPES and np.isfinite(score)}
    if not valid:
        return "unknown"
    modality, score = max(valid.items(), key=lambda item: item[1])
    return f"{modality}_inferred" if score >= threshold else "unknown"


def modality_matches(requested: set[str], classification: str) -> bool:
    if not requested:
        return True
    allowed = set()
    for modality in requested:
        if modality == "remote":
            allowed.update({"remote", "remote_inferred"})
        elif modality == "hybrid":
            allowed.update({"remote", "remote_inferred", "hybrid", "hybrid_inferred"})
        elif modality == "on_site":
            allowed.update({"on_site", "on_site_inferred", "unknown"})
    return classification in allowed
