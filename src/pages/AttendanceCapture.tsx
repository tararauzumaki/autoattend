import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { Camera, AlertCircle, CheckCircle, RefreshCw, User } from 'lucide-react';
import * as faceapi from 'face-api.js';

interface Student {
  id: string;
  name: string;
  student_id: string;
  course: string;
  photo_url: string;
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  status: 'present' | 'absent';
  created_at: string;
  students: {
    name: string;
    student_id: string;
  };
}

const AttendanceCapture = () => {
  const [course, setCourse] = useState('');
  const [courses, setCourses] = useState<string[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [recognizedStudents, setRecognizedStudents] = useState<string[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<number | null>(null);
  
  useEffect(() => {
    fetchCourses();
    
    return () => {
      // Clean up webcam on unmount
      stopWebcam();
    };
  }, []);
  
  useEffect(() => {
    if (course) {
      fetchStudentsByCourse(course);
      fetchAttendanceRecords(course);
    }
  }, [course]);
  
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
      setError('Failed to load courses');
    }
  };
  
  const fetchStudentsByCourse = async (courseName: string) => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('course', courseName)
        .order('name');
        
      if (error) {
        throw error;
      }
      
      setStudents(data || []);
    } catch (error: any) {
      console.error('Error fetching students:', error.message);
      setError('Failed to load students for the selected course');
    }
  };
  
  const fetchAttendanceRecords = async (courseName: string) => {
    try {
      // Get today's date in ISO format (YYYY-MM-DD)
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('attendance')
        .select('*, students(name, student_id)')
        .eq('course', courseName)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`)
        .order('created_at', { ascending: false });
        
      if (error) {
        throw error;
      }
      
      setAttendanceRecords(data || []);
      
      // Update recognized students from already marked attendance
      const recognized = data
        ?.filter(record => record.status === 'present')
        .map(record => record.student_id) || [];
      setRecognizedStudents(recognized);
    } catch (error: any) {
      console.error('Error fetching attendance records:', error.message);
    }
  };
  
  const loadFaceRecognitionModels = async () => {
    try {
      setIsModelLoading(true);
      setError(null);
      
      // Load face-api.js models
      await Promise.all([
        faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.ssdMobilenetv1.loadFromUri('/models')
      ]);
      
      setIsModelLoaded(true);
    } catch (error: any) {
      console.error('Error loading face recognition models:', error);
      setError('Failed to load face recognition models. Please try again.');
    } finally {
      setIsModelLoading(false);
    }
  };
  
  const startWebcam = async () => {
    try {
      setError(null);
      
      // First load models if not already loaded
      if (!isModelLoaded) {
        await loadFaceRecognitionModels();
      }
      
      // Start webcam
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      setIsWebcamActive(true);
    } catch (error: any) {
      console.error('Error starting webcam:', error);
      setError('Failed to access webcam. Please check your camera permissions.');
    }
  };
  
  const stopWebcam = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setIsWebcamActive(false);
    setIsCapturing(false);
  };
  
  const startFaceRecognition = async () => {
    if (!isWebcamActive || !videoRef.current || !canvasRef.current || students.length === 0) {
      return;
    }
    
    setIsCapturing(true);
    setError(null);
    
    // Create labeled face descriptors for all students
    const labeledDescriptors = await Promise.all(
      students.map(async (student) => {
        try {
          // Load student image
          const img = await faceapi.fetchImage(student.photo_url);
          
          // Detect face and compute descriptors
          const detections = await faceapi.detectSingleFace(img)
            .withFaceLandmarks()
            .withFaceDescriptor();
            
          if (!detections) {
            console.warn(`No face detected in the reference image for ${student.name}`);
            return null;
          }
          
          return new faceapi.LabeledFaceDescriptors(
            student.id, // Use student ID as label
            [detections.descriptor]
          );
        } catch (error) {
          console.error(`Error processing reference image for ${student.name}:`, error);
          return null;
        }
      })
    );
    
    // Filter out null entries
    const validDescriptors = labeledDescriptors.filter(descriptor => descriptor !== null) as faceapi.LabeledFaceDescriptors[];
    
    if (validDescriptors.length === 0) {
      setError('Could not create face descriptors from student photos. Please check the photos.');
      setIsCapturing(false);
      return;
    }
    
    // Create face matcher
    const faceMatcher = new faceapi.FaceMatcher(validDescriptors, 0.6); // 0.6 is the distance threshold
    
    // Set up recognition interval
    intervalRef.current = window.setInterval(async () => {
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        // Make sure video is playing
        if (video.paused || video.ended || !video.videoWidth) {
          return;
        }
        
        // Match canvas size to video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Detect all faces in the frame
        const detections = await faceapi.detectAllFaces(video)
          .withFaceLandmarks()
          .withFaceDescriptors();
          
        // Clear previous drawings
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        
        // Draw video frame on canvas
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Process each detected face
        for (const detection of detections) {
          // Match against known faces
          const match = faceMatcher.findBestMatch(detection.descriptor);
          const studentId = match.label;
          
          // Draw face rectangle and label
          const box = detection.detection.box;
          const drawBox = new faceapi.draw.DrawBox(box, { 
            label: match.label !== 'unknown' 
              ? students.find(s => s.id === studentId)?.name || 'Unknown'
              : 'Unknown',
            boxColor: match.label !== 'unknown' ? '#4ADE80' : '#EF4444'
          });
          drawBox.draw(canvas);
          
          // If a match is found and not already recognized, add to recognized list
          if (match.label !== 'unknown' && !recognizedStudents.includes(studentId)) {
            setRecognizedStudents(prev => [...prev, studentId]);
            
            // Mark student as present in database
            try {
              await supabase.from('attendance').insert({
                student_id: studentId,
                course,
                status: 'present'
              });
              
              // Refresh attendance records
              fetchAttendanceRecords(course);
            } catch (error) {
              console.error('Error marking attendance:', error);
            }
          }
        }
      }
    }, 1000); // Process every second
  };
  
  const stopFaceRecognition = () => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsCapturing(false);
  };
  
  const markAbsentStudents = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      setSuccessMessage(null);
      
      // Find students who are not in recognizedStudents
      const absentStudentIds = students
        .filter(student => !recognizedStudents.includes(student.id))
        .map(student => student.id);
      
      if (absentStudentIds.length === 0) {
        setSuccessMessage('All students are present!');
        setIsSubmitting(false);
        return;
      }
      
      // Create attendance records for absent students
      const absentRecords = absentStudentIds.map(studentId => ({
        student_id: studentId,
        course,
        status: 'absent' as const
      }));
      
      const { error } = await supabase
        .from('attendance')
        .insert(absentRecords);
        
      if (error) {
        throw error;
      }
      
      fetchAttendanceRecords(course);
      setSuccessMessage('Attendance has been completed successfully!');
    } catch (error: any) {
      console.error('Error marking absent students:', error);
      setError('Failed to mark absent students: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold text-gray-800">Attendance Capture</h1>
        <p className="text-gray-600">Take attendance using facial recognition</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <div className="mb-4">
            <label htmlFor="course-select" className="block text-sm font-medium text-gray-700 mb-1">
              Select Course
            </label>
            <select
              id="course-select"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">-- Select a course --</option>
              {courses.map((courseName, index) => (
                <option key={index} value={courseName}>
                  {courseName}
                </option>
              ))}
            </select>
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-200 text-red-700 rounded-md flex items-center">
              <AlertCircle size={16} className="mr-2" />
              {error}
            </div>
          )}
          
          {successMessage && (
            <div className="mb-4 p-3 bg-green-100 border border-green-200 text-green-700 rounded-md flex items-center">
              <CheckCircle size={16} className="mr-2" />
              {successMessage}
            </div>
          )}
          
          {isModelLoading && (
            <div className="py-8 text-center text-gray-500">
              <RefreshCw size={24} className="mx-auto mb-2 animate-spin" />
              <p>Loading face recognition models...</p>
            </div>
          )}
          
          <div className="relative bg-black rounded-lg overflow-hidden mb-4">
            <video 
              ref={videoRef}
              autoPlay
              playsInline
              className={`w-full ${isWebcamActive ? '' : 'hidden'}`}
            />
            <canvas 
              ref={canvasRef}
              className={`absolute inset-0 w-full h-full ${isWebcamActive ? '' : 'hidden'}`}
            />
            {!isWebcamActive && (
              <div className="aspect-video bg-gray-100 flex flex-col items-center justify-center p-8 text-gray-500">
                <Camera size={48} className="mb-4" />
                <p className="text-center mb-2">Camera is not active</p>
                <p className="text-sm text-center">
                  Click the "Start Camera" button below to begin capturing attendance.
                </p>
              </div>
            )}
          </div>
          
          <div className="flex flex-wrap gap-3">
            {!isWebcamActive ? (
              <Button 
                variant="primary" 
                onClick={startWebcam}
                disabled={!course || isModelLoading}
                className="flex items-center"
              >
                <Camera size={16} className="mr-1" />
                Start Camera
              </Button>
            ) : !isCapturing ? (
              <>
                <Button 
                  variant="primary" 
                  onClick={startFaceRecognition}
                  disabled={students.length === 0}
                  className="flex items-center"
                >
                  <Camera size={16} className="mr-1" />
                  Start Face Recognition
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={stopWebcam}
                >
                  Stop Camera
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="secondary" 
                  onClick={stopFaceRecognition}
                >
                  Pause Recognition
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={stopWebcam}
                >
                  Stop Camera
                </Button>
                <Button 
                  variant="success" 
                  onClick={markAbsentStudents}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Completing...' : 'Complete Attendance'}
                </Button>
              </>
            )}
          </div>
        </Card>
        
        <Card title="Attendance Status" className="lg:col-span-1">
          {!course ? (
            <div className="text-center py-8 text-gray-500">
              Select a course to view attendance status
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No students found for this course
            </div>
          ) : (
            <>
              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Present: {recognizedStudents.length}</span>
                  <span>Absent: {students.length - recognizedStudents.length}</span>
                  <span>Total: {students.length}</span>
                </div>
                <div className="bg-gray-200 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-green-500 h-full rounded-full"
                    style={{ width: `${(recognizedStudents.length / students.length) * 100}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                {students.map((student) => {
                  const isPresent = recognizedStudents.includes(student.id);
                  const attendanceRecord = attendanceRecords.find(
                    record => record.student_id === student.id
                  );
                  
                  return (
                    <div key={student.id} className="py-3 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-2 h-2 rounded-full ${isPresent ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{student.name}</p>
                          <p className="text-xs text-gray-500">{student.student_id}</p>
                        </div>
                      </div>
                      {attendanceRecord && (
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          attendanceRecord.status === 'present' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {attendanceRecord.status === 'present' ? 'Present' : 'Absent'} 
                          {attendanceRecord.created_at && ` • ${formatDate(attendanceRecord.created_at)}`}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AttendanceCapture;