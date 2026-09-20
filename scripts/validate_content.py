"""Pre-deployment and CI Content Integrity Validator.

Invokes app.cli.validate_content to audit all curriculum content and generate docs/BETA_CONTENT_AUDIT.md.
"""

import sys
from pathlib import Path

# Add apps/api to path
root_dir = Path(__file__).resolve().parent.parent
api_dir = root_dir / "apps" / "api"
sys.path.insert(0, str(api_dir))

from app.cli.validate_content import main

if __name__ == "__main__":
    main()
