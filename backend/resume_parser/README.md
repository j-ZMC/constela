# Resume Parser

This project provides a Python function for extracting resume information from PDF files. It has no desktop interface or web server; call `process_resume` from the server-side handler that receives a file uploaded by your web page.

## Test from the command line

Run the module without arguments to open a PDF selection popup:

```powershell
python resume_parser.py
```

Or pass the PDF path directly, which skips the popup:

```powershell
python resume_parser.py "C:\path\to\resume.pdf"
```

The PDF and its JSON file are saved in the project's `resumes` directory. Importing the module from a web backend does not run this command-line test.

## Use from a web backend

Save the uploaded PDF to a temporary file, then pass that file's path to the parser:

```python
from pathlib import Path
from tempfile import NamedTemporaryFile

from resume_parser import process_resume


def handle_resume_upload(uploaded_file):
    with NamedTemporaryFile(suffix=".pdf", delete=False) as temporary_file:
        uploaded_file.save(temporary_file)
        temporary_path = Path(temporary_file.name)

    try:
        return process_resume(temporary_path)
    finally:
        temporary_path.unlink(missing_ok=True)
```

The web page's upload button should submit the PDF to a backend endpoint; the backend calls `handle_resume_upload` and can return its result as JSON. The function returns a dictionary with extracted resume fields and saves the PDF and a matching JSON file in the project's `resumes` directory. If a filename already exists, it uses a numbered suffix instead of overwriting it.

The `resume_taxonomy.json` file must remain beside `resume_parser.py`. It contains skill and domain terms, English and Spanish section headings, and employment-related phrases. Scanned PDFs without an OCR text layer cannot be parsed.
