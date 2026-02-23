import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import QuoteModal from './components/QuoteModal';
import Home from './pages/Home';
import Partnerships from './pages/Partnerships';
import ManageBooking from './pages/ManageBooking';

function App() {
    return (
        <BrowserRouter>
            <main className="bg-background min-h-screen text-foreground selection:bg-primary selection:text-white">
                <Navbar />
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/partnerships" element={<Partnerships />} />
                    <Route path="/manage-booking" element={<ManageBooking />} />
                </Routes>
                <QuoteModal />
            </main>
        </BrowserRouter>
    );
}

export default App;
