import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, MessageCircle, HelpCircle, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Support = () => {
  const navigate = useNavigate();

  const faqs = [
    {
      question: "Hva er Zeivo?",
      answer: "Zeivo er en sammenligningstjeneste som hjelper deg å ta smarte kjøpsbeslutninger ved å vise prisforskjellen mellom nye og brukte produkter. Vi henter priser fra ledende norske butikker og sammenligner med bruktmarkedet på Finn.no."
    },
    {
      question: "Hvordan fungerer prissammenligningen?",
      answer: "Vi oppdaterer prisene automatisk ved å hente data fra ulike norske nettbutikker som Elkjøp, Komplett, Power og NetOnNet. For brukte priser analyserer vi aktive annonser på Finn.no for å gi deg et realistisk prisintervall."
    },
    {
      question: "Hvor ofte oppdateres prisene?",
      answer: "Prisene oppdateres regelmessig for å sikre at du alltid får mest mulig oppdatert informasjon. Brukte priser oppdateres basert på aktive annonser på Finn.no."
    },
    {
      question: "Hva er prisvarsler?",
      answer: "Med prisvarsler kan du sette en målpris for et produkt. Når prisen faller til eller under ditt ønskede nivå, får du automatisk beskjed på e-post. Dette gjør det enkelt å kjøpe når prisen er riktig for deg."
    },
    {
      question: "Må jeg logge inn for å bruke Zeivo?",
      answer: "Ja, du må opprette en gratis konto for å søke og sammenligne priser. Dette hjelper oss å gi deg en bedre opplevelse og muligheten til å sette opp prisvarsler og få personlige varsler."
    },
    {
      question: "Er Zeivo gratis å bruke?",
      answer: "Ja, Zeivo er helt gratis å bruke. Vi tjener penger når du klikker videre til butikkene gjennom våre lenker, men dette påvirker ikke prisene du ser."
    },
    {
      question: "Hvilke produkter dekker dere?",
      answer: "Vi fokuserer på elektronikk og teknologiprodukter som telefoner, datamaskiner, hodetelefoner og annet utstyr som har god verdi på bruktmarkedet. Vi utvider sortimentet løpende."
    },
    {
      question: "Hvorfor viser dere brukte priser?",
      answer: "Vi ønsker å gjøre det lettere å ta bærekraftige valg. Mange produkter fungerer like bra brukt som nye, og du kan spare betydelige beløp samtidig som du bidrar til en mer sirkulær økonomi."
    },
    {
      question: "Kan jeg stole på prisene?",
      answer: "Vi gjør vårt beste for å vise korrekte priser, men anbefaler alltid at du sjekker endelig pris hos butikken før kjøp. Priser kan endre seg raskt, og tilgjengelighet kan variere."
    },
    {
      question: "Hvordan kontakter jeg support?",
      answer: "Du kan nå oss på kontakt@zeivo.no for alle spørsmål, tilbakemeldinger eller support. Vi svarer vanligvis innen 1-2 virkedager."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Tilbake til Zeivo
          </Button>
        </div>
      </nav>

      {/* Header */}
      <section className="container mx-auto px-4 py-16 text-center">
        <HelpCircle className="h-16 w-16 text-accent mx-auto mb-6" />
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Hjelp og support
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Finn svar på de vanligste spørsmålene om Zeivo
        </p>
      </section>

      {/* FAQ Section */}
      <section className="container mx-auto px-4 py-8 max-w-4xl">
        <h2 className="text-3xl font-bold mb-8">Ofte stilte spørsmål</h2>
        
        <Accordion type="single" collapsible className="space-y-4">
          {faqs.map((faq, index) => (
            <AccordionItem 
              key={index} 
              value={`item-${index}`}
              className="border rounded-lg px-6 bg-card"
            >
              <AccordionTrigger className="text-left hover:no-underline py-6">
                <span className="font-semibold text-lg">{faq.question}</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-6">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Contact Section */}
      <section className="container mx-auto px-4 py-16 max-w-4xl">
        <h2 className="text-3xl font-bold mb-8 text-center">Finner du ikke svaret?</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <Mail className="h-8 w-8 text-accent mb-2" />
              <CardTitle>Send oss en e-post</CardTitle>
              <CardDescription>
                Vi svarer vanligvis innen 1-2 virkedager
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => window.location.href = 'mailto:kontakt@zeivo.no'}
              >
                kontakt@zeivo.no
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <MessageCircle className="h-8 w-8 text-accent mb-2" />
              <CardTitle>Tilbakemelding</CardTitle>
              <CardDescription>
                Del dine ideer for forbedringer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => window.location.href = 'mailto:kontakt@zeivo.no?subject=Tilbakemelding'}
              >
                Send tilbakemelding
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border mt-16 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2025 Zeivo — kjøp smart, spar bærekraftig</p>
          <p className="mt-2">Laget i Norge 🇳🇴</p>
        </div>
      </footer>
    </div>
  );
};

export default Support;
