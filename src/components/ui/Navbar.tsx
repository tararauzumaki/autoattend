import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, User, Calendar, BarChart3, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';

const Navbar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <nav className="bg-blue-600 text-white shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <Camera className="h-8 w-8" />
              <span className="font-bold text-xl">AutoAttend</span>
            </Link>
          </div>

          {/* Desktop Menu */}
          {user && (
            <div className="hidden md:flex items-center space-x-6">
              <Link to="/dashboard" className="hover:text-blue-200 transition-colors flex items-center space-x-1">
                <span>Dashboard</span>
              </Link>
              <Link to="/students" className="hover:text-blue-200 transition-colors flex items-center space-x-1">
                <User className="h-4 w-4" />
                <span>Students</span>
              </Link>
              <Link to="/attendance" className="hover:text-blue-200 transition-colors flex items-center space-x-1">
                <Calendar className="h-4 w-4" />
                <span>Attendance</span>
              </Link>
              <Link to="/reports" className="hover:text-blue-200 transition-colors flex items-center space-x-1">
                <BarChart3 className="h-4 w-4" />
                <span>Reports</span>
              </Link>
              <button 
                onClick={handleLogout}
                className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-md flex items-center space-x-1 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          )}

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button 
              onClick={toggleMobileMenu}
              className="p-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && user && (
        <div className="md:hidden bg-blue-700 pb-4 px-4">
          <div className="flex flex-col space-y-3">
            <Link 
              to="/dashboard" 
              className="hover:bg-blue-600 px-3 py-2 rounded-md transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Dashboard
            </Link>
            <Link 
              to="/students" 
              className="hover:bg-blue-600 px-3 py-2 rounded-md transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Students
            </Link>
            <Link 
              to="/attendance" 
              className="hover:bg-blue-600 px-3 py-2 rounded-md transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Attendance
            </Link>
            <Link 
              to="/reports" 
              className="hover:bg-blue-600 px-3 py-2 rounded-md transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Reports
            </Link>
            <button 
              onClick={handleLogout}
              className="bg-blue-800 hover:bg-blue-900 px-3 py-2 text-left rounded-md transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;