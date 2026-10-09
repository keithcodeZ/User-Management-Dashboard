import { useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import SearchBar from './components/SearchBar.jsx';
import UserFormDialog from './components/UserFormDialog.jsx';
import UserTable from './components/UserTable.jsx';
import { useDebouncedValue } from './hooks/useDebouncedValue.js';
import { useUsers } from './hooks/useUsers.js';

function filterUsers(users, searchTerm) {
  if (searchTerm === '') {
    return users;
  }
  const term = searchTerm.toLowerCase();
  return users.filter((user) => matchesSearch(user, term));
}

function matchesSearch(user, term) {
  return (
    user.name.toLowerCase().includes(term) ||
    user.username.toLowerCase().includes(term) ||
    user.email.toLowerCase().includes(term)
  );
}

function App() {
  const { users, loading, error, reload, createUser, updateUser } = useUsers();
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [formDialog, setFormDialog] = useState({
    open: false,
    user: null,
    key: 0,
  });
  const searchTerm = useDebouncedValue(searchText, 300).trim();
  const matchingUsers = filterUsers(users, searchTerm);

  function handleSearchChange(text) {
    setSearchText(text);
    setPage(0);
  }

  function handleRowsPerPageChange(rows) {
    setRowsPerPage(rows);
    setPage(0);
  }

  // A new key remounts the dialog with fresh state. Closing changes only
  // `open`, so the content stays in place during the exit transition.
  function openCreateDialog() {
    setFormDialog((current) => ({
      open: true,
      user: null,
      key: current.key + 1,
    }));
  }

  function openEditDialog(user) {
    setFormDialog((current) => ({
      open: true,
      user,
      key: current.key + 1,
    }));
  }

  function closeFormDialog() {
    setFormDialog((current) => ({ ...current, open: false }));
  }

  // A failed save rejects to the dialog, which stays open to show the errors.
  async function handleSave(value) {
    const editedUser = formDialog.user;
    if (editedUser === null) {
      await createUser(value);
      closeFormDialog();
      return;
    }

    const updated = await updateUser(editedUser.id, value);
    closeFormDialog();
    // `matchingUsers` is the list from before the update. If the edited user
    // was the only row on a later page and no longer matches the search, that
    // page is now empty, so show the previous one.
    if (
      page > 0 &&
      page * rowsPerPage >= matchingUsers.length - 1 &&
      filterUsers([updated], searchTerm).length === 0
    ) {
      setPage(page - 1);
    }
  }

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', p: 3 }}>
      <Stack spacing={3}>
        <Typography variant="h4" component="h1">
          User Management Dashboard
        </Typography>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <SearchBar value={searchText} onChange={handleSearchChange} />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreateDialog}
          >
            Add User
          </Button>
        </Stack>
        <UserTable
          users={matchingUsers}
          loading={loading}
          error={error}
          onRetry={reload}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={setPage}
          onRowsPerPageChange={handleRowsPerPageChange}
          onEdit={openEditDialog}
        />
      </Stack>
      <UserFormDialog
        key={formDialog.key}
        open={formDialog.open}
        user={formDialog.user}
        onSubmit={handleSave}
        onClose={closeFormDialog}
      />
    </Box>
  );
}

export default App;
