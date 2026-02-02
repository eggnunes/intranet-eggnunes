import { Layout } from '@/components/Layout';
import { TribunalLinksCards } from '@/components/processos/TribunalLinksCards';
import { TribunalLinksAdmin } from '@/components/processos/TribunalLinksAdmin';
import { useUserRole } from '@/hooks/useUserRole';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Scale, Settings } from 'lucide-react';

export default function PortaisTribunais() {
  const { isAdmin } = useUserRole();

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="h-6 w-6" />
            Portais de Tribunais
          </h1>
          <p className="text-muted-foreground">
            Acesso rápido aos sistemas de processos eletrônicos
          </p>
        </div>

        <TribunalLinksCards />

        {isAdmin && (
          <Accordion type="single" collapsible className="mt-6">
            <AccordionItem value="admin">
              <AccordionTrigger className="text-base font-semibold">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Gerenciar Portais (Admin)
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <TribunalLinksAdmin />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </div>
    </Layout>
  );
}
