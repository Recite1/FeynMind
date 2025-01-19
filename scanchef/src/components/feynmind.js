"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, StopCircle, Loader, Upload, X, AlertCircle, CheckCircle } from 'lucide-react';

const ExplanationEvaluator = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [transcription, setTranscription] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [topic, setTopic] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState('');
  const [audioDuration, setAudioDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const audioRef = useRef(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimerRef = useRef(null);
  const [audioSource, setAudioSource] = useState('');
  const [flashcards, setFlashcards] = useState([]);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlippped, setIsFlipped] = useState(false);
  const [isGeneratingCards, setIsGeneratingCards] = useState(false);
  
  // Cleanup function for audio resources
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      stopRecording();
    };
  }, []);

  // Handle recording timer
  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(recordingTimerRef.current);
      setRecordingTime(0);
    }
    return () => clearInterval(recordingTimerRef.current);
  }, [isRecording]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const resetAll = () => {
    setAudioBlob(null);
    setTranscription('');
    setEvaluation(null);
    setFileName('');
    setAudioDuration(0);
    setAudioSource('');
    setFlashcards([]);
    setShowFlashcards(false);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
    }
  };

  const generateFlashcards = async () => {
    if (!transcription || !topic) {
      setError('Please record and transcribe an explanation first.');
      return;
    }

    setIsGeneratingCards(true);
    setError(null);

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'mixtral-8x7b-32768',
          messages: [
            {
              role: 'system',
              content: `You are an expert at creating educational flashcards. Based on the provided transcription, create up to 15 flashcards that capture the key concepts and important points from the explanation.
              If the transcription is not clear or detailed enough, utilize information from the internet that is both consice and doesn't deviate from the topic. Don't create flashcards that ask similar questions.

              Provide your response in JSON format with the following structure:
              {
                "flashcards": [
                  {
                    "front": "Question or concept",
                    "back": "Answer or explanation"
                  }
                ]
              }

              Make the cards concise but comprehensive. The front should be a clear question or prompt, and the back should provide a complete but focused answer.`
            },
            {
              role: 'user',
              content: `Topic: ${topic}\n\nTranscription: ${transcription}\n\nPlease create flashcards from this explanation.`
            }
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate flashcards');
      }

      const data = await response.json();
      const cards = JSON.parse(data.choices[0].message.content).flashcards;
      setFlashcards(cards);
      setShowFlashcards(true);
      setCurrentCardIndex(0);
      setIsFlipped(false);
    } catch (error) {
      setError('Failed to generate flashcards. Please try again.');
      console.error('Flashcard generation error:', error);
    } finally {
      setIsGeneratingCards(false);
    }
  };

  const nextCard = () => {
    if (currentCardIndex < flashcards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setIsFlipped(false);
    }
  };

  const previousCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(prev => prev - 1);
      setIsFlipped(false);
    }
  };

  const startRecording = async () => {
    try {
      resetAll();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      
      mediaRecorder.current.ondataavailable = (event) => {
        audioChunks.current.push(event.data);
      };

      mediaRecorder.current.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
        setAudioBlob(audioBlob);
        setAudioSource('recording');
        audioChunks.current = [];
        setFileName('Recorded Audio');
        
        // Get audio duration
        const audio = new Audio(URL.createObjectURL(audioBlob));
        audio.onloadedmetadata = () => {
          setAudioDuration(Math.round(audio.duration));
        };
      };

      mediaRecorder.current.start();
      setIsRecording(true);
      setError(null);
    } catch (error) {
      setError('Error accessing microphone. Please ensure you have granted microphone permissions.');
      console.error('Error accessing microphone:', error);
    }
  };

  const handleFileUpload = async (file) => {
    try {
      // Check file size (max 25MB)
      if (file.size > 25 * 1024 * 1024) {
        throw new Error('File size exceeds 25MB limit');
      }

      // Check file type
      if (!file.type.startsWith('audio/')) {
        throw new Error('Please upload an audio file');
      }

      resetAll();
      setAudioBlob(file);
      setAudioSource('upload');
      setFileName(file.name);
      
      // Get audio duration
      const audio = new Audio(URL.createObjectURL(file));
      audio.onloadedmetadata = () => {
        setAudioDuration(Math.round(audio.duration));
      };
      
      setError(null);
    } catch (error) {
      setError(error.message);
      console.error('File upload error:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const transcribeWithGroq = async (audioBlob) => {
    try {
      console.log('Preparing audio data for transcription...');
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.wav');
      formData.append('model', 'whisper-large-v3-turbo');

      console.log('Sending transcription request to GROQ...');
      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_GROQ_API_KEY}`,
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('GROQ Transcription Error Response:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(`Failed to transcribe audio: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('GROQ Transcription Response:', data);
      return data.text;
    } catch (error) {
      console.error('Transcription Error:', error);
      throw new Error('Failed to transcribe audio. Please try again.');
    }
  };

  const evaluateWithGroq = async (transcription, topic) => {
    try {
      console.log('Sending evaluation request to GROQ...');
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'mixtral-8x7b-32768',
          messages: [
            {
              role: 'system',
              content: `You are an expert at evaluating explanations. Evaluate how well the speaker explains the given topic.
              
              Provide your response in JSON format with the following structure:
              {
                "clarity": number (0-100),
                "completeness": number (0-100),
                "organization": number (0-100),
                "overallScore": number (0-100),
                "feedback": string[]
              }
              
              Evaluate based on:
              - Clarity: How clear and understandable the explanation is
              - Completeness: How thoroughly the topic is covered
              - Organization: How well-structured the explanation is
              
              Provide 3-5 specific feedback points in the feedback array.`
            },
            {
              role: 'user',
              content: `Topic: ${topic}\n\nTranscription: ${transcription}\n\nPlease evaluate this explanation.`
            }
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('GROQ API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(`Failed to evaluate explanation: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('GROQ API Response:', data);
      return JSON.parse(data.choices[0].message.content);
    } catch (error) {
      console.error('GROQ API Error:', error);
      throw new Error('Failed to evaluate explanation. Please try again.');
    }
  };

  const evaluateExplanation = async () => {
    if (!audioBlob || !topic.trim()) {
      setError('Please record or upload an explanation and specify a topic first.');
      return;
    }

    if (topic.length < 3) {
      setError('Please enter a more specific topic (at least 3 characters).');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      console.log(`Processing ${audioSource} audio...`);
      const transcriptionText = await transcribeWithGroq(audioBlob);
      setTranscription(transcriptionText);

      const evaluationResult = await evaluateWithGroq(transcriptionText, topic);
      setEvaluation(evaluationResult);
    } catch (error) {
      setError(error.message || 'An error occurred during evaluation. Please try again.');
      console.error('Process error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const playRecording = () => {
    if (!audioBlob) return;

    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio(URL.createObjectURL(audioBlob));
      audioRef.current.onended = () => setIsPlaying(false);
    }

    audioRef.current.play();
    setIsPlaying(true);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Explanation Evaluator</h2>
          <p className="text-gray-600">Record or upload an audio explanation, and get AI-powered feedback.</p>
        </div>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
            <input
              type="text"
              placeholder="Enter the topic you'll be explaining..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isRecording || isProcessing}
            />
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="flex gap-4">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`flex items-center gap-2 px-4 py-2 rounded text-white font-medium transition-colors ${
                  isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                disabled={isProcessing}
                title={isRecording ? "Stop Recording" : "Start Recording"}
              >
                {isRecording ? (
                  <>
                    <Square className="w-4 h-4" /> Stop ({formatTime(recordingTime)})
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" /> Record
                  </>
                )}
              </button>

              <label 
                className={`flex items-center gap-2 px-4 py-2 rounded bg-purple-500 hover:bg-purple-600 text-white font-medium cursor-pointer transition-colors ${
                  (isRecording || isProcessing) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                title="Upload Audio File"
              >
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                  disabled={isRecording || isProcessing}
                />
                <Upload className="w-4 h-4" />
                Upload Audio
              </label>
            </div>

            {audioBlob && (
              <div className="flex gap-4 items-center">
                <div className="text-sm text-gray-600">
                  {fileName} ({audioDuration > 0 ? formatTime(audioDuration) : 'Loading...'})
                </div>
                <button 
                  onClick={playRecording} 
                  className="flex items-center gap-2 px-4 py-2 rounded bg-gray-500 hover:bg-gray-600 text-white font-medium disabled:opacity-50 transition-colors"
                  disabled={isProcessing}
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <StopCircle className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
                <button
                  onClick={resetAll}
                  className="flex items-center gap-2 px-4 py-2 rounded bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
                  title="Clear Audio"
                >
                  <X className="w-4 h-4" /> Clear
                </button>
                <button 
                  onClick={evaluateExplanation} 
                  className="flex items-center gap-2 px-4 py-2 rounded bg-green-500 hover:bg-green-600 text-white font-medium disabled:opacity-50 transition-colors"
                  disabled={isProcessing}
                  title={isProcessing ? "Processing..." : "Evaluate Explanation"}
                >
                  {isProcessing ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Evaluate
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {transcription && (
            <div className="bg-gray-50 border border-gray-200 p-4 rounded">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Transcription
              </h3>
              <p className="text-sm text-gray-700 leading-relaxed">{transcription}</p>
            </div>
          )}

          {evaluation && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">{evaluation.clarity}%</div>
                    <div className="text-sm text-gray-500 mt-1">Clarity</div>
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">{evaluation.completeness}%</div>
                    <div className="text-sm text-gray-500 mt-1">Completeness</div>
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600">{evaluation.organization}%</div>
                    <div className="text-sm text-gray-500 mt-1">Organization</div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
                <div className="space-y-2">
                  <div className="font-semibold text-lg flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Overall Score: {evaluation.overallScore}%
                  </div>
                  <div className="space-y-2 mt-3">
                    {evaluation.feedback.map((feedback, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm">
                        <span className="text-blue-500 mt-1">•</span>
                        <span>{feedback}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {transcription && !showFlashcards && (
            <div className="flex justify-center mt-6">
              <button
                onClick={generateFlashcards}
                className="flex items-center gap-2 px-6 py-2 rounded bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-colors disabled:opacity-50"
                disabled={isGeneratingCards}
              >
                {isGeneratingCards ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Generating Flashcards...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                    Generate Flashcards
                  </>
                )}
              </button>
            </div>
          )}

          {showFlashcards && flashcards.length > 0 && (
            <div className="mt-8 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Study Flashcards</h3>
                <button
                  onClick={() => setShowFlashcards(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col items-center space-y-4">
                <div 
                  className="w-full max-w-2xl h-64 cursor-pointer perspective-1000"
                  onClick={() => setIsFlipped(!isFlippped)}
                >
                  <div className={`relative w-full h-full transition-transform duration-500 transform-style-preserve-3d ${isFlippped ? 'rotate-y-180' : ''}`}>
                    {/* Front of card */}
                    <div className={`absolute w-full h-full bg-white rounded-xl shadow-lg p-6 backface-hidden ${isFlippped ? 'invisible' : ''}`}>
                      <div className="flex flex-col justify-between h-full">
                        <div className="text-center text-lg font-medium">
                          {flashcards[currentCardIndex].front}
                        </div>
                        <div className="text-center text-sm text-gray-500">
                          Click to reveal answer
                        </div>
                      </div>
                    </div>
                    
                    {/* Back of card */}
                    <div className={`absolute w-full h-full bg-white rounded-xl shadow-lg p-6 rotate-y-180 backface-hidden ${!isFlippped ? 'invisible' : ''}`}>
                      <div className="flex flex-col justify-between h-full">
                        <div className="text-center text-lg">
                          {flashcards[currentCardIndex].back}
                        </div>
                        <div className="text-center text-sm text-gray-500">
                          Click to see question
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={previousCard}
                    disabled={currentCardIndex === 0}
                    className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <div className="text-sm text-gray-600">
                    Card {currentCardIndex + 1} of {flashcards.length}
                  </div>
                  <button
                    onClick={nextCard}
                    disabled={currentCardIndex === flashcards.length - 1}
                    className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExplanationEvaluator;
