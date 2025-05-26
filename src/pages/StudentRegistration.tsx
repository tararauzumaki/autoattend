import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { UserPlus, Camera, X, Upload, CheckCircle } from 'lucide-react';
import * as faceapi from 'face-api.js';

interface Student {
  id: string;
  name: string;
  student_id: string;
  course: string;
  photo_url: string;
  descriptor: number[] | null;
  created_at: string;
}

const StudentRegistration = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [course, setCourse] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUsingWebcam, setIsUsingWebcam] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    loadModels();
    fetchStudents();
  }, []);

  const loadModels = async () => {
    try {
      setIsModelLoading(true);
      await Promise.all([
        faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.ssdMobilenetv1.loadFromUri('/models')
      ]);
      setIsModelLoading(false);
    } catch (error) {
      console.error('Error loading face-api models:', error);
      setError('Failed to load facial recognition models');
    }
  };
  
  const fetchStudents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) {
        throw error;
      }
      
      setStudents(data || []);
    } catch (error: any) {
      console.error('Error fetching students:', error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const startWebcam = async () => {
    setIsUsingWebcam(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing webcam:', error);
      setError('Could not access webcam. Please check your permissions.');
      setIsUsingWebcam(false);
    }
  };
  
  const stopWebcam = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsUsingWebcam(false);
  };
  
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], 'student-photo.jpg', { type: 'image/jpeg' });
            setPhoto(file);
            setPhotoPreview(URL.createObjectURL(blob));
          }
        }, 'image/jpeg', 0.95);
      }
      
      stopWebcam();
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };
  
  const clearPhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const resetForm = () => {
    setName('');
    setStudentId('');
    setCourse('');
    clearPhoto();
    setError(null);
  };

  const computeFaceDescriptor = async (imageUrl: string): Promise<Float32Array | null> => {
    try {
      const img = await faceapi.fetchImage(imageUrl);
      const detection = await faceapi.detectSingleFace(img)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        throw new Error('No face detected in the image');
      }

      return detection.descriptor;
    } catch (error) {
      console.error('Error computing face descriptor:', error);
      throw error;
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    
    if (!name || !studentId || !course || !photo) {
      setError('All fields are required, including student photo');
      return;
    }

    if (isModelLoading) {
      setError('Please wait for facial recognition models to load');
      return;
    }
    
    try {
      setIsSaving(true);
      
      // Upload photo to Supabase Storage
      const fileExt = photo.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `students/${fileName}`;
      
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('images')
        .upload(filePath, photo);
        
      if (uploadError) {
        throw uploadError;
      }
      
      // Get public URL for the uploaded image
      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      // Compute face descriptor
      const descriptor = await computeFaceDescriptor(publicUrl);
      if (!descriptor) {
        throw new Error('Failed to compute facial features. Please ensure the photo shows a clear face.');
      }

      // Create student record with descriptor
      const { error: insertError } = await supabase
        .from('students')
        .insert({
          name,
          student_id: studentId,
          course,
          photo_url: publicUrl,
          descriptor: Array.from(descriptor) // Convert Float32Array to regular array for storage
        });
        
      if (insertError) {
        throw insertError;
      }
      
      setSuccessMessage('Student registered successfully!');
      resetForm();
      fetchStudents();
    } catch (error: any) {
      console.error('Error registering student:', error);
      setError('Failed to register student: ' + error.message);

      // Clean up uploaded file if student creation fails
      if (filePath) {
        await supabase.storage
          .from('images')
          .remove([filePath]);
      }
    } finally {
      setIsSaving(false);
    }
  };
  
  const filteredStudents = students.filter(student => 
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.student_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.course.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold text-gray-800">Student Registration</h1>
        <p className="text-gray-600">Register students for facial recognition attendance</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1" title="Register New Student">
          {isModelLoading && (
            <div className="mb-4 p-3 bg-blue-100 border border-blue-200 text-blue-700 rounded-md">
              Loading facial recognition models...
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 bg-green-100 border border-green-200 text-green-700 rounded-md flex items-center">
              <CheckCircle size={16} className="mr-2" />
              {successMessage}
            </div>
          )}
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-200 text-red-700 rounded-md">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <Input
                label="Full Name"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                fullWidth
                required
              />
              
              <Input
                label="Student ID"
                id="studentId"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="S12345"
                fullWidth
                required
              />
              
              <Input
                label="Course/Class"
                id="course"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                placeholder="Computer Science 101"
                fullWidth
                required
              />
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Student Photo
                </label>
                
                {photoPreview ? (
                  <div className="relative w-full h-48 border border-gray-300 rounded-md overflow-hidden mb-2">
                    <img 
                      src={photoPreview} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={clearPhoto}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-md p-6 flex flex-col items-center justify-center text-gray-500 mb-2">
                    <Camera size={32} className="mb-2" />
                    <p className="text-sm text-center">
                      Take a photo or upload an image file
                    </p>
                  </div>
                )}
                
                <div className="flex space-x-2">
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    id="photo-upload"
                  />
                  
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center"
                  >
                    <Upload size={16} className="mr-1" />
                    Upload
                  </Button>
                  
                  {isUsingWebcam ? (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={capturePhoto}
                      className="flex-1"
                    >
                      Capture
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={startWebcam}
                      className="flex-1 flex items-center justify-center"
                    >
                      <Camera size={16} className="mr-1" />
                      Camera
                    </Button>
                  )}
                </div>
              </div>
              
              <Button 
                type="submit" 
                variant="primary" 
                fullWidth 
                disabled={isSaving || isModelLoading}
                className="mt-4"
              >
                <UserPlus size={16} className="mr-1" />
                {isSaving ? 'Registering...' : 'Register Student'}
              </Button>
            </div>
          </form>
          
          {isUsingWebcam && (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-lg p-4 max-w-md w-full">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">Take Student Photo</h3>
                  <button 
                    onClick={stopWebcam}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="relative bg-black rounded-md overflow-hidden">
                  <video 
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full"
                  />
                </div>
                
                <div className="flex justify-center mt-4 space-x-3">
                  <Button variant="secondary" onClick={stopWebcam}>
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={capturePhoto}>
                    <Camera size={16} className="mr-1" />
                    Capture Photo
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          <canvas ref={canvasRef} className="hidden" />
        </Card>
        
        <Card className="lg:col-span-2" title="Registered Students">
          <div className="mb-4">
            <Input
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              fullWidth
            />
          </div>
          
          {loading ? (
            <div className="py-8 text-center text-gray-500">
              Loading students...
            </div>
          ) : filteredStudents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Photo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Course
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredStudents.map((student) => (
                    <tr key={student.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100">
                          {student.photo_url ? (
                            <img 
                              src={student.photo_url} 
                              alt={student.name} 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <UserPlus size={16} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {student.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {student.student_id}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {student.course}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">
              No students found. Register your first student.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default StudentRegistration;