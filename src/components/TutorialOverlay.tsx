import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ChevronRight, ChevronLeft, X, BookOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface TutorialStep {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

interface TutorialOverlayProps {
  pageKey: string;
  steps: TutorialStep[];
  pageName: string;
}

const TUTORIAL_PREFIX = 'tutorial-seen-';

export const TutorialOverlay = ({ pageKey, steps, pageName }: TutorialOverlayProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const { user } = useAuth();

  useEffect(() => {
    // Fast check: localStorage fallback to avoid flash
    const seenLocal = localStorage.getItem(TUTORIAL_PREFIX + pageKey);
    if (seenLocal) return;

    if (!user) return;

    // Check database
    const checkSeen = async () => {
      const { data } = await supabase
        .from('tutorial_seen')
        .select('id')
        .eq('user_id', user.id)
        .eq('page_key', pageKey)
        .maybeSingle();

      if (data) {
        // Sync to localStorage for future fast checks
        localStorage.setItem(TUTORIAL_PREFIX + pageKey, 'true');
      } else {
        setIsOpen(true);
      }
    };

    checkSeen();
  }, [pageKey, user]);

  const handleClose = async () => {
    setIsOpen(false);
    setCurrentStep(0);
    localStorage.setItem(TUTORIAL_PREFIX + pageKey, 'true');

    if (user) {
      await supabase
        .from('tutorial_seen')
        .upsert(
          { user_id: user.id, page_key: pageKey },
          { onConflict: 'user_id,page_key' }
        );
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const reopenTutorial = () => {
    setCurrentStep(0);
    setIsOpen(true);
  };

  const step = steps[currentStep];

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={reopenTutorial}
        className="gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <BookOpen className="h-3.5 w-3.5" />
        Ver tutorial
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {step?.icon}
              {step?.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {pageName} — Passo {currentStep + 1} de {steps.length}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm leading-relaxed">{step?.description}</p>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-2 w-2 rounded-full transition-colors ${
                  i === currentStep ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>

          <DialogFooter className="flex justify-between sm:justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
            <Button size="sm" onClick={handleNext}>
              {currentStep === steps.length - 1 ? (
                'Concluir'
              ) : (
                <>
                  Próximo
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
