import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/ui/Card';
import { Users, Camera, Calendar, BarChart3 } from 'lucide-react';

interface DashboardStats {
  totalStudents: number;
  totalAttendance: number;
  todayPresent: number;
  todayAbsent: number;
}

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalAttendance: 0,
    todayPresent: 0,
    todayAbsent: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch total students
        const { count: studentCount, error: studentError } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true });

        // Fetch total attendance records
        const { count: attendanceCount, error: attendanceError } = await supabase
          .from('attendance')
          .select('*', { count: 'exact', head: true });

        // Fetch today's attendance
        const today = new Date().toISOString().split('T')[0];
        const { count: todayPresentCount, error: todayPresentError } = await supabase
          .from('attendance')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'present')
          .gte('created_at', `${today}T00:00:00`)
          .lte('created_at', `${today}T23:59:59`);

        // Calculate today's absent students
        const todayAbsentCount = studentCount ? studentCount - (todayPresentCount || 0) : 0;

        // Fetch recent activity
        const { data: recentData, error: recentError } = await supabase
          .from('attendance')
          .select('*, students(name)')
          .order('created_at', { ascending: false })
          .limit(5);

        if (studentError || attendanceError || todayPresentError || recentError) {
          throw new Error('Error fetching dashboard data');
        }

        setStats({
          totalStudents: studentCount || 0,
          totalAttendance: attendanceCount || 0,
          todayPresent: todayPresentCount || 0,
          todayAbsent: todayAbsentCount,
        });

        setRecentActivity(recentData || []);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-600">Welcome back, {user?.user_metadata?.name || 'Admin'}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-blue-50 border border-blue-100">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600 mr-4">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm text-blue-600 font-medium">Total Students</p>
              <p className="text-2xl font-bold text-blue-800">
                {loading ? '...' : stats.totalStudents}
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-green-50 border border-green-100">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600 mr-4">
              <Calendar size={24} />
            </div>
            <div>
              <p className="text-sm text-green-600 font-medium">Present Today</p>
              <p className="text-2xl font-bold text-green-800">
                {loading ? '...' : stats.todayPresent}
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-orange-50 border border-orange-100">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-orange-100 text-orange-600 mr-4">
              <Calendar size={24} />
            </div>
            <div>
              <p className="text-sm text-orange-600 font-medium">Absent Today</p>
              <p className="text-2xl font-bold text-orange-800">
                {loading ? '...' : stats.todayAbsent}
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-purple-50 border border-purple-100">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 text-purple-600 mr-4">
              <BarChart3 size={24} />
            </div>
            <div>
              <p className="text-sm text-purple-600 font-medium">Total Attendance</p>
              <p className="text-2xl font-bold text-purple-800">
                {loading ? '...' : stats.totalAttendance}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2" title="Quick Actions">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link 
              to="/students" 
              className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="p-3 rounded-full bg-blue-100 text-blue-600 mr-4">
                <Users size={20} />
              </div>
              <div>
                <h3 className="font-medium text-gray-800">Register Students</h3>
                <p className="text-sm text-gray-600">Add new students to the system</p>
              </div>
            </Link>

            <Link 
              to="/attendance" 
              className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="p-3 rounded-full bg-green-100 text-green-600 mr-4">
                <Camera size={20} />
              </div>
              <div>
                <h3 className="font-medium text-gray-800">Take Attendance</h3>
                <p className="text-sm text-gray-600">Capture attendance using facial recognition</p>
              </div>
            </Link>

            <Link 
              to="/reports" 
              className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="p-3 rounded-full bg-purple-100 text-purple-600 mr-4">
                <BarChart3 size={20} />
              </div>
              <div>
                <h3 className="font-medium text-gray-800">View Reports</h3>
                <p className="text-sm text-gray-600">Generate and view attendance reports</p>
              </div>
            </Link>
          </div>
        </Card>

        <Card title="Recent Activity">
          {loading ? (
            <div className="py-8 text-center text-gray-500">Loading...</div>
          ) : recentActivity.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {recentActivity.map((activity, index) => (
                <li key={index} className="py-3">
                  <div className="flex space-x-3">
                    <div className={`w-2 h-2 rounded-full mt-2 ${activity.status === 'present' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {activity.students?.name || 'Unknown Student'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {activity.status === 'present' ? 'Marked present' : 'Marked absent'} • {formatDate(activity.created_at)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-8 text-center text-gray-500">No recent activity</div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;