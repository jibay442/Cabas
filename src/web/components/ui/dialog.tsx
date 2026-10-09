import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import * as React from "react";
import { useT } from "../../lib/i18n.tsx";
import { cn } from "../../lib/utils.ts";

export const Dialog = DialogPrimitive.Root;
export const DialogClose = DialogPrimitive.Close;

function Overlay() {
  return (
    <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50" />
  );
}

function CloseButton() {
  const t = useT();
  return (
    <DialogPrimitive.Close className="absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:outline-hidden [&_svg]:size-4">
      <XIcon />
      <span className="sr-only">{t("common.close")}</span>
    </DialogPrimitive.Close>
  );
}

export function DialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <Overlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
          className,
        )}
        {...props}
      >
        {children}
        <CloseButton />
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/**
 * Panneau : glisse depuis le bas sur mobile (à portée de pouce), depuis la droite sur grand écran.
 */
export function SheetContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <Overlay />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "bg-card data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col shadow-lg duration-200",
          "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-xl border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          "sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-[26rem] sm:rounded-none sm:rounded-l-xl sm:border-t-0 sm:border-l sm:data-[state=closed]:slide-out-to-right sm:data-[state=open]:slide-in-from-right",
          className,
        )}
        {...props}
      >
        <div className="bg-muted-foreground/30 mx-auto mt-2 h-1 w-10 shrink-0 rounded-full sm:hidden" aria-hidden />
        {children}
        <CloseButton />
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("flex flex-col gap-1.5 text-left", className)} {...props} />;
}
export function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-footer" className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />;
}
export function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title data-slot="dialog-title" className={cn("text-lg leading-none font-semibold", className)} {...props} />;
}
export function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description data-slot="dialog-description" className={cn("text-muted-foreground text-sm", className)} {...props} />;
}

/** Panneau prêt à l'emploi : titre, description facultative, contenu défilant */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Pas de focus automatique : sur mobile, il ouvrirait le clavier dès l'ouverture */}
      <SheetContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="border-b px-5 pt-4 pb-3 pr-12 sm:pt-5">
          <DialogTitle className="text-base">{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
        </DialogHeader>
        <div className="overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </SheetContent>
    </Dialog>
  );
}
