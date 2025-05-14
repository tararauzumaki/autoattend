import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { BarChart3, Calendar, Download, Users, PieChart } from 'lucide-react';

interface AttendanceRecord {
  id: string;
  student_id: string;
  course: string;
  status: 'present' | 'absent';
  created_at: string;
  students: {
    name: string;
    student_id: string;
  };
}

interface AttendanceStats {
  totalRecords: number;
  presentCount: number;
  absentCount: number;
}

const Reports = () => {
  const [courses, setCourses] = useState<string[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<AttendanceStats>({
    totalRecords: 0,
    presentCount: 0,
    absentCount: 0,
  });
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  useEffect(() => {
    fetchCourses();
    
    // Set default date range to current month
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    setStartDate(firstDayOfMonth.toISOString().split('T')[0]);
    setEndDate(lastDayOfMonth.toISOString().split('T')[0]);
  }, []);
  
  useEffect(() => {
    if (selectedCourse && startDate && endDate) {
      fetchAttendanceData();
    }
  }, [selectedCourse, startDate, endDate]);
  
  useEffect(() => {
    if (attendanceRecords.length > 0) {
      filterRecords();
    }
  }, [searchTerm, attendanceRecords]);
  
  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('course')
        .order('course');
        
      if (error) {
        throw error;
      }
      
      // Extract unique courses
      const uniqueCourses = Array.from(new Set(data.map(item => item.course)));
      setCourses(uniqueCourses);
    } catch (error: any) {
      console.error('Error fetching courses:', error.message);
    }
  };
  
  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      
      // Format dates for query
      const startDateFormatted = `${startDate}T00:00:00`;
      const endDateFormatted = `${endDate}T23:59:59`;
      
      const { data, error } = await supabase
        .from('attendance')
        .select('*, students(name, student_id)')
        .eq('course', selectedCourse)
        .gte('created_at', startDateFormatted)
        .lte('created_at', endDateFormatted)
        .order('created_at', { ascending: false });
        
      if (error) {
        throw error;
      }
      
      setAttendanceRecords(data || []);
      setFilteredRecords(data || []);
      
      // Calculate stats
      const presentCount = data?.filter(record => record.status === 'present').length || 0;
      const absentCount = data?.filter(record => record.status === 'absent').length || 0;
      
      setStats({
        totalRecords: data?.length || 0,
        presentCount,
        absentCount,
      });
    } catch (error: any) {
      console.error('Error fetching attendance data:', error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const filterRecords = () => {
    if (!searchTerm.trim()) {
      setFilteredRecords(attendanceRecords);
      return;
    }
    
    const filtered = attendanceRecords.filter(record => 
      record.students?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.students?.student_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    setFilteredRecords(filtered);
  };
  
  const exportToCSV = () => {
    if (filteredRecords.length === 0) return;
    
    // Create CSV header
    const headers = ['Date', 'Time', 'Student ID', 'Student Name', 'Status'];
    
    // Create CSV rows
    const rows = filteredRecords.map(record => {
      const date = new Date(record.created_at);
      const dateStr = date.toLocaleDateString();
      const timeStr = date.toLocaleTimeString();
      
      return [
        dateStr,
        timeStr,
        record.students?.student_id || '',
        record.students?.name || '',
        record.status
      ];
    });
    
    // Combine header and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Create file and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedCourse}-attendance-${startDate}-to-${endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
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
        <h1 className="text-2xl font-bold text-gray-800">Attendance Reports</h1>
        <p className="text-gray-600">Generate and view attendance reports</p>
      </div>
      
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label htmlFor="course-select" className="block text-sm font-medium text-gray-700 mb-1">
              Course
            </label>
            <select
              id="course-select"
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">-- Select Course --</option>
              {courses.map((course, index) => (
                <option key={index} value={course}>
                  {course}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              fullWidth
            />
          </div>
          
          <div>
            <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              fullWidth
            />
          </div>
          
          <div className="flex items-end">
            <Button 
              variant="primary" 
              onClick={fetchAttendanceData} 
              disabled={!selectedCourse || !startDate || !endDate || loading}
              className="w-full"
            >
              <BarChart3 size={16} className="mr-1" />
              Generate Report
            </Button>
          </div>
        </div>
      </Card>
      
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : selectedCourse && attendanceRecords.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-blue-50 border border-blue-100">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-blue-100 text-blue-600 mr-4">
                  <Users size={24} />
                </div>
                <div>
                  <p className="text-sm text-blue-600 font-medium">Total Records</p>
                  <p className="text-2xl font-bold text-blue-800">{stats.totalRecords}</p>
                </div>
              </div>
            </Card>
            
            <Card className="bg-green-50 border border-green-100">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-green-100 text-green-600 mr-4">
                  <Users size={24} />
                </div>
                <div>
                  <p className="text-sm text-green-600 font-medium">Present</p>
                  <p className="text-2xl font-bold text-green-800">
                    {stats.presentCount}
                    <span className="text-sm font-normal ml-1">
                      ({Math.round((stats.presentCount / stats.totalRecords) * 100)}%)
                    </span>
                  </p>
                </div>
              </div>
            </Card>
            
            <Card className="bg-red-50 border border-red-100">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-red-100 text-red-600 mr-4">
                  <Users size={24} />
                </div>
                <div>
                  <p className="text-sm text-red-600 font-medium">Absent</p>
                  <p className="text-2xl font-bold text-red-800">
                    {stats.absentCount}
                    <span className="text-sm font-normal ml-1">
                      ({Math.round((stats.absentCount / stats.totalRecords) * 100)}%)
                    </span>
                  </p>
                </div>
              </div>
            </Card>
          </div>
          
          <Card title="Attendance Records">
            <div className="flex justify-between items-center mb-4">
              <Input
                placeholder="Search by student name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
              
              <Button 
                variant="secondary" 
                onClick={exportToCSV}
                disabled={filteredRecords.length === 0}
              >
                <Download size={16} className="mr-1" />
                Export CSV
              </Button>
            </div>
            
            {filteredRecords.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date & Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Student ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Student Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredRecords.map((record) => (
                      <tr key={record.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(record.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {record.students?.student_id || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {record.students?.name || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            record.status === 'present'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {record.status === 'present' ? 'Present' : 'Absent'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-gray-500">
                No records found. Try adjusting your search criteria.
              </div>
            )}
          </Card>
        </>
      ) : selectedCourse ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">No attendance records found</h3>
          <p className="text-gray-500">
            There are no attendance records for the selected course and date range.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <BarChart3 size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">Generate an Attendance Report</h3>
          <p className="text-gray-500">
            Select a course and date range to generate an attendance report.
          </p>
        </div>
      )}
    </div>
  );
};

export default Reports;