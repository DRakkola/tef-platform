"""Transactional email delivery provider interfaces."""

from abc import ABC, abstractmethod


class EmailProvider(ABC):
    """Abstract interface for transactional emails (verification, booking notices)."""

    @abstractmethod
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: str | None = None,
    ) -> bool:
        """Send an email to a recipient."""


class MockEmailProvider(EmailProvider):
    """Mock email provider storing sent emails in memory for test verification."""

    def __init__(self) -> None:
        self.sent_emails: list[dict] = []

    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: str | None = None,
    ) -> bool:
        self.sent_emails.append(
            {
                "to": to_email,
                "subject": subject,
                "html": html_content,
                "text": text_content,
            }
        )
        return True
