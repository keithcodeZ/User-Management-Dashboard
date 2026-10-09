import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import UserTable from './components/UserTable.jsx';
import { useUsers } from './hooks/useUsers.js';

function App() {
  const { users, loading, error, reload } = useUsers();

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', p: 3 }}>
      <Stack spacing={3}>
        <Typography variant="h4" component="h1">
          User Management Dashboard
        </Typography>
        <Stack direction="row" spacing={2} />
        <UserTable
          users={users}
          loading={loading}
          error={error}
          onRetry={reload}
        />
      </Stack>
    </Box>
  );
}

export default App;
