import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface DeleteListingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  mode: 'archive' | 'permanent';
}

export function DeleteListingDialog({ isOpen, onClose, onConfirm, mode }: DeleteListingDialogProps) {
  const title = mode === 'archive' ? 'Archive Listing' : 'Permanently Delete Listing';
  const description = mode === 'archive'
    ? 'This will move the listing to your archived listings. You can restore it later, but it will be automatically deleted after 7 days.'
    : 'This will permanently delete the listing. This action cannot be undone.';

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={mode === 'permanent' ? 'bg-destructive hover:bg-destructive/90' : ''}
          >
            {mode === 'archive' ? 'Archive' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}