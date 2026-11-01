import argparse
import json
import pdfplumber
import re
import shutil
from pathlib import Path

def load_taxonomy():
    taxonomy_path = Path(__file__).with_name("resume_taxonomy.json")
    try:
        with taxonomy_path.open(encoding="utf-8") as taxonomy_file:
            taxonomy = json.load(taxonomy_file)
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError(
            f"Could not load the taxonomy file {taxonomy_path}: {error}"
        ) from error

    required_lists = (
        "experience_headings",
        "other_section_headings",
        "employment_cues",
    )
    if not isinstance(taxonomy, dict) or not isinstance(taxonomy.get("sectors"), dict):
        raise ValueError("resume_taxonomy.json must contain a 'sectors' object.")

    for section in required_lists:
        if not isinstance(taxonomy.get(section), list) or not all(
            isinstance(term, str) and term.strip() for term in taxonomy[section]
        ):
            raise ValueError(
                f"resume_taxonomy.json must contain a valid '{section}' list."
            )
    for sector, terms in taxonomy["sectors"].items():
        valid_sector = isinstance(sector, str) and sector.strip()
        valid_terms = isinstance(terms, list) and all(
            isinstance(term, str) and term.strip() for term in terms
        )
        if not valid_sector or not valid_terms:
            raise ValueError(
                f"Sector '{sector}' must have a list of non-empty terms."
            )

    return taxonomy


TAXONOMY = load_taxonomy()
SECTORS = TAXONOMY["sectors"]
EXPERIENCE_HEADINGS = set(TAXONOMY["experience_headings"])
OTHER_SECTION_HEADINGS = set(TAXONOMY["other_section_headings"])
EMPLOYMENT_CUES = re.compile(
    r"(?<!\w)(?:" + "|".join(
        re.escape(cue) for cue in TAXONOMY["employment_cues"]
    ) + r")(?!\w)",
    re.IGNORECASE
)
SECTOR_PATTERNS = {
    sector: [
        (
            term,
            re.compile(r"(?<!\w)" + re.escape(term) + r"(?!\w)", re.IGNORECASE)
        )
        for term in terms
    ]
    for sector, terms in SECTORS.items()
}


def _normalize_heading(line):
    return re.sub(r"[^a-záéíóúñ]+", " ", line.lower()).strip()


def extract_experience(text):
    lines = [line.strip(" \t•*-") for line in text.splitlines()]
    normalized_lines = [_normalize_heading(line.rstrip(":")) for line in lines]
    inline_experience = []
    experience_indexes = [
        index for index, heading in enumerate(normalized_lines)
        if heading in EXPERIENCE_HEADINGS
    ]
    for index, line in enumerate(lines):
        if index in experience_indexes:
            continue
        for heading in sorted(EXPERIENCE_HEADINGS, key=len, reverse=True):
            prefix = line.lower()
            if prefix.startswith(heading) and len(prefix) > len(heading):
                separator = prefix[len(heading)]
                if separator in ":—–-":
                    content = line[len(heading) + 1:].strip(" \t:—–-")
                    experience_indexes.append(index)
                    if content:
                        inline_experience.append((index, content))
                    break

    if experience_indexes:
        section_start = min(experience_indexes)
        start = section_start + 1
        end = len(lines)
        for index in range(start, len(lines)):
            if normalized_lines[index] in OTHER_SECTION_HEADINGS:
                end = index
                break
        inline_content = [
            content for index, content in inline_experience
            if index == section_start
        ]
        return inline_content + [line for line in lines[start:end] if line]

    date_range = re.compile(
        r"\b(?:19|20)\d{2}\s*(?:-|–|—|to|a|hasta)\s*"
        r"(?:(?:19|20)\d{2}|present|current|presente|actualidad)\b",
        re.IGNORECASE
    )
    education_cues = re.compile(
        r"\b(?:university|universidad|college|degree|bachelor|master|"
        r"licenciatura|maestr[ií]a|instituto|school|escuela)\b",
        re.IGNORECASE
    )
    date_indexes = [
        index for index, line in enumerate(lines) if date_range.search(line)
    ]
    section_indexes = [
        index for index, heading in enumerate(normalized_lines)
        if heading in EXPERIENCE_HEADINGS or heading in OTHER_SECTION_HEADINGS
    ]
    relevant_indexes = set()
    for date_index in date_indexes:
        context = lines[max(0, date_index - 2):min(len(lines), date_index + 3)]
        if not any(EMPLOYMENT_CUES.search(line) for line in context) and any(
            education_cues.search(line) for line in context
        ):
            continue
        end = len(lines)
        for index in date_indexes + section_indexes:
            if index > date_index:
                end = min(end, index)
        relevant_indexes.update(range(max(0, date_index - 1), end))

    for index, line in enumerate(lines):
        has_work_cue = bool(EMPLOYMENT_CUES.search(line))
        if not has_work_cue or date_range.search(line):
            continue
        relevant_indexes.update(range(max(0, index - 1), min(len(lines), index + 2)))

    return [lines[index] for index in sorted(relevant_indexes) if lines[index]]


def extract_text_from_pdf(file_path):
    text = ""
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            text += page_text if page_text else ""
    return text

def extract_information(text):
    text_lines = text.splitlines()

    phone_numbers = re.findall(r"\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}", text)
    emails = re.findall(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", text)


    name = "Not Found"
    for line in text_lines[:5]:
        if len(line.strip()) > 2 and not any(keyword in line.lower() for keyword in ["email", "phone", "linkedin", "github", "address"]):
            name = line.strip().title()
            break

    if name == "Not Found":

        declaration_match = re.search(r"declaration.*?([a-z\s]{3,25})\s*\n", text, re.DOTALL)
        if declaration_match:
            name = declaration_match.group(1).strip().title()


    skills_found = []
    for terms in SECTOR_PATTERNS.values():
        for term, pattern in terms:
            display_term = term.title()
            if pattern.search(text) and display_term not in skills_found:
                skills_found.append(display_term)

    project_pattern = r"projects.*?[\n|•](.*?)\n"
    projects = re.findall(project_pattern, text, re.DOTALL)
    projects = [proj.strip("• ").capitalize() for proj in projects if proj]

    projects = [proj for proj in projects if "education" not in proj.lower()]


    matched_sectors = [
        sector
        for sector, terms in SECTOR_PATTERNS.items()
        if any(pattern.search(text) for _, pattern in terms)
    ]

    return {
        "name": name,
        "email": emails[0] if emails else "N/A",
        "phone": phone_numbers[0] if phone_numbers else "N/A",
        "skills_found": skills_found,
        "projects": projects,
        "experience": extract_experience(text),
        "sectors": matched_sectors if matched_sectors else ["No sector match found"]
    }

def parse_resume_text(text):
    return extract_information(text) if text and text.strip() else {}


def parse_resume(file_path):
    text = extract_text_from_pdf(file_path)
    return parse_resume_text(text)


def save_resume_pdf(file_path):
    source_path = Path(file_path).resolve()
    if not source_path.is_file():
        raise FileNotFoundError(f"Resume PDF was not found: {source_path}")
    if source_path.suffix.casefold() != ".pdf":
        raise ValueError("The uploaded file must be a PDF.")

    resume_folder = Path(__file__).resolve().parent / "resumes"
    resume_folder.mkdir(exist_ok=True)

    if source_path.parent == resume_folder.resolve():
        return source_path

    destination_path = resume_folder / source_path.name
    copy_number = 1
    while destination_path.exists():
        destination_path = resume_folder / (
            f"{source_path.stem}_{copy_number}{source_path.suffix}"
        )
        copy_number += 1

    shutil.copy2(source_path, destination_path)
    return destination_path


def save_resume_data(pdf_path, parsed_resume):
    json_path = Path(pdf_path).with_suffix(".json")
    with json_path.open("w", encoding="utf-8") as json_file:
        json.dump(parsed_resume, json_file, indent=2, ensure_ascii=False)
        json_file.write("\n")
    return json_path


def process_resume(file_path):
    """Save an uploaded PDF, extract resume data, and save a JSON sidecar."""
    saved_path = save_resume_pdf(file_path)
    parsed_resume = parse_resume(saved_path)
    if not parsed_resume:
        raise ValueError(
            "No extractable text was found in the PDF. Scanned PDFs require OCR."
        )
    save_resume_data(saved_path, parsed_resume)
    return parsed_resume


def main():
    parser = argparse.ArgumentParser(
        description="Extract resume information from a PDF and save it as JSON."
    )
    parser.add_argument(
        "pdf_path",
        type=Path,
        nargs="?",
        help="Path to the resume PDF. If omitted, you will be prompted.",
    )
    args = parser.parse_args()
    pdf_path = args.pdf_path
    if pdf_path is None:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()
        try:
            selected_path = filedialog.askopenfilename(
                parent=root,
                title="Choose a resume PDF",
                initialdir=Path(__file__).resolve().parent,
                filetypes=[("PDF files", "*.pdf")],
            )
        finally:
            root.destroy()
        if not selected_path:
            parser.exit(0)
        pdf_path = Path(selected_path)

    try:
        parsed_resume = process_resume(pdf_path)
    except (OSError, RuntimeError, ValueError) as error:
        parser.exit(1, f"Error: {error}\n")

    print(json.dumps(parsed_resume, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
