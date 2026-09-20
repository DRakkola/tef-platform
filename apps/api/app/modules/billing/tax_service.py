"""Tax calculation abstraction service for multi-jurisdiction compliance."""

from dataclasses import dataclass


@dataclass(frozen=True)
class TaxCalculationResult:
    """Calculated tax rate and amount in integer cents."""

    subtotal_cents: int
    tax_cents: int
    total_cents: int
    tax_rate_bps: int  # Basis points: e.g. 2000 = 20.00%
    jurisdiction: str


class TaxService:
    """Configurable tax calculator.

    Maintains clean domain boundaries so tax calculations remain decoupled
    from business rules and can integrate with Avalara/TaxJar/Stripe Tax in the future.
    """

    DEFAULT_TAX_RATE_BPS = 0  # 0% standard baseline until tax jurisdiction rules are configured

    @classmethod
    def calculate_tax(
        cls, subtotal_cents: int, country_code: str | None = None
    ) -> TaxCalculationResult:
        """Calculate tax on order subtotal using integer arithmetic."""
        if subtotal_cents <= 0:
            return TaxCalculationResult(
                subtotal_cents=0,
                tax_cents=0,
                total_cents=0,
                tax_rate_bps=0,
                jurisdiction="NONE",
            )

        # Configurable jurisdiction lookup
        country = (country_code or "FR").upper()
        # Example VAT rates (in basis points: 2000 = 20.0%)
        # Configured to 0 bps for dev/sandbox baseline unless explicit legal review
        rate_bps = cls.DEFAULT_TAX_RATE_BPS

        tax_cents = (subtotal_cents * rate_bps) // 10000
        total_cents = subtotal_cents + tax_cents

        return TaxCalculationResult(
            subtotal_cents=subtotal_cents,
            tax_cents=tax_cents,
            total_cents=total_cents,
            tax_rate_bps=rate_bps,
            jurisdiction=country,
        )
