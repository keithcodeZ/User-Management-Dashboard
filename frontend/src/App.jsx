import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useUsers } from './hooks/useUsers.js';

function App() {
  const { users, loading, error } = useUsers();

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', p: 3 }}>
      <Stack spacing={3}>
        <Typography variant="h4" component="h1">
          User Management Dashboard
        </Typography>
        <Typography>
          {loading
            ? 'Loading users…'
            : error
              ? error.message
              : `${users.length} users loaded`}
        </Typography>
        <Stack direction="row" spacing={2} />
      </Stack>
    </Box>
  );
}

export default App;
