import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import QuoteModal from './components/QuoteModal';
import Home from './pages/Home';
import Partnerships from './pages/Partnerships';
import ManageBooking from './pages/ManageBooking';

function AppShell() {
    const location = useLocation();
    const hideNavbar = location.pathname === '/manage-booking';

    return (
        <main className="bg-background min-h-screen text-foreground selection:bg-primary selection:text-white">
            {!hideNavbar && <Navbar />}
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/partnerships" element={<Partnerships />} />
                <Route path="/manage-booking" element={<ManageBooking />} />
            </Routes>
            <QuoteModal />
        </main>
    );
}

function App() {
    return (
        <BrowserRouter>
            <AppShell />
        </BrowserRouter>
    );
}

export default App;
