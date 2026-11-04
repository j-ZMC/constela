"""Read a CV (PDF) into the profile Constela uses: name, email, phone, skills, sectors, experience and projects.

The app runs it with --stdin-json (src/app/api/resume/parse/route.ts): the PDF comes in on stdin and the profile goes
out as JSON on stdout; nothing is saved. Run it with a PDF path, or with no arguments to pick a file, to test it by
hand; that mode saves the PDF and its JSON in resumes/, which git ignores.

The first version was based on https://github.com/Vbhargav370/resume_parser.py (pdfplumber and Tkinter). That project
has no license, so the parts that came from it (reading the PDF, and finding the name, email, phone and projects) were
rewritten. The taxonomy, skills, sectors, experience, validation and the stdin mode are the team's own.
"""
import argparse
from io import BytesIO
import json
import pdfplumber
from pdfplumber.utils.exceptions import MalformedPDFException, PdfminerException
import re
import shutil
import sys
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


EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
# Runs of digits and phone separators; only those with 10 to 15 digits count (local or international numbers).
PHONE = re.compile(r"\+?\(?\d[\d ().-]{8,}\d")
NAME_WORD = re.compile(r"[^\W\d_](?:[^\W\d_]|['.-])*")
SECTION_HEADINGS = EXPERIENCE_HEADINGS | OTHER_SECTION_HEADINGS
PROJECT_HEADINGS = {heading for heading in SECTION_HEADINGS if "project" in heading or "proyecto" in heading}


def extract_text_from_pdf(source):
    """The text of every page, in order. `source` is a path or a file-like object."""
    with pdfplumber.open(source) as pdf:
        return "\n".join(page.extract_text() or "" for page in pdf.pages)


def find_name(lines):
    """CVs start with the person's name: the first short line near the top made only of words, not a heading."""
    for line in lines[:6]:
        words = line.split()
        if 2 <= len(words) <= 5 and all(NAME_WORD.fullmatch(word) for word in words) \
                and _normalize_heading(line) not in SECTION_HEADINGS:
            return line.title() if line.isupper() or line.islower() else line
    return ""


def find_phone(text):
    for match in PHONE.finditer(text):
        if 10 <= len(re.sub(r"\D", "", match.group())) <= 15:
            return match.group().strip()
    return ""


def extract_projects(lines):
    """The lines under a Projects heading, up to the next section."""
    projects = []
    inside = False
    for line in lines:
        heading = _normalize_heading(line)
        if heading in PROJECT_HEADINGS:
            inside = True
        elif inside and heading in SECTION_HEADINGS:
            break
        elif inside and line.strip(" \t•*-"):
            projects.append(line.strip(" \t•*-"))
    return projects[:20]


def read_profile(text):
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    email = EMAIL.search(text)
    return {
        "name": find_name(lines),
        "email": email.group() if email else "",
        "phone": find_phone(text),
        # Each skill once, in taxonomy order.
        "skills_found": list(dict.fromkeys(
            term.title() for terms in SECTOR_PATTERNS.values() for term, pattern in terms if pattern.search(text)
        )),
        "projects": extract_projects(lines),
        "experience": extract_experience(text),
        "sectors": [sector for sector, terms in SECTOR_PATTERNS.items() if any(p.search(text) for _, p in terms)],
    }


def parse_resume_text(text):
    return read_profile(text) if text and text.strip() else {}


def parse_resume(file_path):
    return parse_resume_text(extract_text_from_pdf(file_path))


def parse_resume_bytes(pdf_bytes):
    try:
        text = extract_text_from_pdf(BytesIO(pdf_bytes))
    except (MalformedPDFException, PdfminerException) as error:
        raise ValueError("The PDF could not be read.") from error
    if not text or not text.strip():
        raise ValueError(
            "No extractable text was found in the PDF. Scanned PDFs require OCR."
        )
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
    parser.add_argument(
        "--stdin-json",
        action="store_true",
        help=argparse.SUPPRESS,
    )
    args = parser.parse_args()
    if args.stdin_json:
        pdf_bytes = sys.stdin.buffer.read()
        if not pdf_bytes.startswith(b"%PDF-"):
            parser.exit(2, "Error: The uploaded file is not a valid PDF.\n")
        try:
            parsed_resume = parse_resume_bytes(pdf_bytes)
        except ValueError as error:
            parser.exit(2, f"Error: {error}\n")
        print(json.dumps({"profile": parsed_resume}, ensure_ascii=False))
        return

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
