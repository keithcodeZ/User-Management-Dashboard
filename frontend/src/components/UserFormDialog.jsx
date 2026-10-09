import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import { validateUserInput } from '../utils/validation.js';

// Create mode when `user` is null, edit mode prefilled from `user` otherwise.
// Invalid fields stop the submit before any request, and a failed save shows
// the server's field messages under the inputs.
function UserFormDialog({ open, user, onSubmit, onClose }) {
  const [values, setValues] = useState(() => ({
    name: user?.name ?? '',
    username: user?.username ?? '',
    email: user?.email ?? '',
  }));
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const { value, errors: fieldErrors } = validateUserInput(values);
    setErrors(fieldErrors ?? {});
    if (fieldErrors) {
      return;
    }

    // On success `submitting` stays true while the dialog closes, so the form
    // cannot be sent twice.
    setSubmitting(true);
    try {
      await onSubmit(value);
    } catch (err) {
      setErrors(err.fields ?? {});
      setSubmitting(false);
    }
  }

  // Escape and backdrop clicks do nothing while a save is in progress.
  function handleClose() {
    if (!submitting) {
      onClose();
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <Box component="form" noValidate onSubmit={handleSubmit}>
        <DialogTitle>{user ? 'Edit User' : 'Add User'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Name"
            name="name"
            value={values.name}
            onChange={handleChange}
            error={Boolean(errors.name)}
            helperText={errors.name}
          />
          <TextField
            fullWidth
            margin="dense"
            label="Username"
            name="username"
            value={values.username}
            onChange={handleChange}
            error={Boolean(errors.username)}
            helperText={errors.username}
          />
          <TextField
            fullWidth
            margin="dense"
            label="Email"
            name="email"
            value={values.email}
            onChange={handleChange}
            error={Boolean(errors.email)}
            helperText={errors.email}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            {user ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

export default UserFormDialog;
