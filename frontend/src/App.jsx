import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import SearchBar from './components/SearchBar.jsx';
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
  const { users, loading, error, reload } = useUsers();
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const searchTerm = useDebouncedValue(searchText, 300).trim();

  function handleSearchChange(text) {
    setSearchText(text);
    setPage(0);
  }

  function handleRowsPerPageChange(rows) {
    setRowsPerPage(rows);
    setPage(0);
  }

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', p: 3 }}>
      <Stack spacing={3}>
        <Typography variant="h4" component="h1">
          User Management Dashboard
        </Typography>
        <Stack direction="row" spacing={2}>
          <SearchBar value={searchText} onChange={handleSearchChange} />
        </Stack>
        <UserTable
          users={filterUsers(users, searchTerm)}
          loading={loading}
          error={error}
          onRetry={reload}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={setPage}
          onRowsPerPageChange={handleRowsPerPageChange}
        />
      </Stack>
    </Box>
  );
}

export default App;
