import { PageContainer, Section } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

export default function KundliResultNotFound() {
  return (
    <Section className="star-field">
      <PageContainer className="px-0">
        <ErrorState
          title="Kundli result not found"
          message="This private result may have expired in local development storage, or the link may be incorrect."
        />
        <Button className="mt-6" href="/kundli" variant="premium">
          Generate a New Kundli
        </Button>
      </PageContainer>
    </Section>
  );
}
