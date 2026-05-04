import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import {
  AppBar, Toolbar, Typography, Drawer, List, ListItemButton,
  ListItemIcon, ListItemText, Box, Container,
} from '@mui/material';
import CategoryIcon from '@mui/icons-material/Category';
import QuizIcon from '@mui/icons-material/Quiz';
import PeopleIcon from '@mui/icons-material/People';
import EventNoteIcon from '@mui/icons-material/EventNote';
import AssessmentIcon from '@mui/icons-material/Assessment';

import CategoriesPage        from './pages/CategoriesPage.jsx';
import QuestionnairesPage    from './pages/QuestionnairesPage.jsx';
import EmployeesPage         from './pages/EmployeesPage.jsx';
import CyclesPage            from './pages/CyclesPage.jsx';
import ReviewsPage           from './pages/ReviewsPage.jsx';
import ReviewDetailPage      from './pages/ReviewDetailPage.jsx';

const DRAWER_WIDTH = 220;

const navItems = [
  { path: '/categories',     label: 'Categories',     icon: <CategoryIcon /> },
  { path: '/questionnaires', label: 'Questionnaires', icon: <QuizIcon /> },
  { path: '/employees',      label: 'Employees',      icon: <PeopleIcon /> },
  { path: '/cycles',         label: 'Review Cycles',  icon: <EventNoteIcon /> },
  { path: '/reviews',        label: 'Reviews',        icon: <AssessmentIcon /> },
];

export default function App() {
  const location = useLocation();

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6">Appraisal Bot — HR Admin</Typography>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          [`& .MuiDrawer-paper`]: { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <List>
          {navItems.map((item) => (
            <ListItemButton
              key={item.path}
              component={Link}
              to={item.path}
              selected={location.pathname.startsWith(item.path)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        <Container maxWidth="lg">
          <Routes>
            <Route path="/" element={<Navigate to="/categories" replace />} />
            <Route path="/categories"     element={<CategoriesPage />} />
            <Route path="/questionnaires" element={<QuestionnairesPage />} />
            <Route path="/employees"      element={<EmployeesPage />} />
            <Route path="/cycles"         element={<CyclesPage />} />
            <Route path="/reviews"        element={<ReviewsPage />} />
            <Route path="/reviews/cycle/:cycleId/employee/:employeeId" element={<ReviewDetailPage />} />
          </Routes>
        </Container>
      </Box>
    </Box>
  );
}