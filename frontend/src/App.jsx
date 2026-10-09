import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

function App() {
  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', p: 3 }}>
      <Stack spacing={3}>
        <Typography variant="h4" component="h1">
          User Management Dashboard
        </Typography>
        <Stack direction="row" spacing={2} />
      </Stack>
    </Box>
  );
}

export default App;
