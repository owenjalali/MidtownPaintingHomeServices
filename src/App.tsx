import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import QuoteModal from './components/QuoteModal';
import Home from './pages/Home';
import Partnerships from './pages/Partnerships';
import ManageBooking from './pages/ManageBooking';
import FieldRepIntake from './pages/FieldRepIntake';
import FieldLeadBooking from './pages/FieldLeadBooking';

function AppShell() {
    const location = useLocation();
    const hideNavbar =
        location.pathname === '/manage-booking' ||
        location.pathname.startsWith('/field/') ||
        location.pathname.startsWith('/field-booking/');

    return (
        <main className="bg-background min-h-screen text-foreground selection:bg-primary selection:text-white">
            {!hideNavbar && <Navbar />}
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/partnerships" element={<Partnerships />} />
                <Route path="/manage-booking" element={<ManageBooking />} />
                <Route path="/field/:accessKey" element={<FieldRepIntake />} />
                <Route path="/field-booking/:leadId" element={<FieldLeadBooking />} />
            </Routes>
            {!hideNavbar && <QuoteModal />}
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
