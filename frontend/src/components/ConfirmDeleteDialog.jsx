import { useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogTitle from '@mui/material/DialogTitle';

// Asks before `user` is deleted. A failed delete enables both buttons again
// and keeps the dialog open.
function ConfirmDeleteDialog({ open, user, onConfirm, onClose }) {
  const [submitting, setSubmitting] = useState(false);

  // On success `submitting` stays true while the dialog closes, so the delete
  // cannot be sent twice.
  async function handleConfirm() {
    setSubmitting(true);
    try {
      await onConfirm();
    } catch {
      setSubmitting(false);
    }
  }

  // Escape and backdrop clicks do nothing while a delete is in progress.
  function handleClose() {
    if (!submitting) {
      onClose();
    }
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>Delete {user?.name}?</DialogTitle>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          color="error"
          variant="contained"
          onClick={handleConfirm}
          disabled={submitting}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ConfirmDeleteDialog;
