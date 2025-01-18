"use client";

import React, { useState, useRef } from 'react';
import { Mic, Square, Play, StopCircle, Loader } from 'lucide-react';

const ExplanationEvaluator = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [transcription, setTranscription] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [topic, setTopic] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);

  const [audioSource, setAudioSource] = useState(''); // 'recording' or 'upload'

  const startRecording = async () => {
    try {
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
      };

      mediaRecorder.current.start();
      setIsRecording(true);
      setError(null);
    } catch (error) {
      setError('Error accessing microphone. Please ensure you have granted microphone permissions.');
      console.error('Error accessing microphone:', error);
    }
  };

  const handleFileUpload = (file) => {
    setAudioBlob(file);
    setAudioSource('upload');
    setError(null);
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
    if (!audioBlob || !topic) {
      setError('Please record or upload an explanation and specify a topic first.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // First, transcribe the audio using GROQ's Whisper model
      console.log(`Processing ${audioSource} audio...`);
      const transcriptionText = await transcribeWithGroq(audioBlob);
      setTranscription(transcriptionText);

      // Then, evaluate the transcription using GROQ's chat model
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
    if (audioBlob) {
      const audio = new Audio(URL.createObjectURL(audioBlob));
      audio.play();
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-4">Explanation Evaluator</h2>
        </div>
        
        <div className="space-y-6">
          <div>
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
                className={`flex items-center gap-2 px-4 py-2 rounded text-white font-medium ${
                  isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
                } disabled:opacity-50`}
                disabled={isProcessing}
              >
                {isRecording ? (
                  <>
                    <Square className="w-4 h-4" /> Stop Recording
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" /> Start Recording
                  </>
                )}
              </button>

              <label className="flex items-center gap-2 px-4 py-2 rounded bg-purple-500 hover:bg-purple-600 text-white font-medium cursor-pointer disabled:opacity-50">
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
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Upload Audio
              </label>
            </div>

            {audioBlob && (
              <>
                <button 
                  onClick={playRecording} 
                  className="flex items-center gap-2 px-4 py-2 rounded bg-gray-500 hover:bg-gray-600 text-white font-medium disabled:opacity-50"
                  disabled={isProcessing}
                >
                  <Play className="w-4 h-4" /> Play Recording
                </button>
                <button 
                  onClick={evaluateExplanation} 
                  className="flex items-center gap-2 px-4 py-2 rounded bg-green-500 hover:bg-green-600 text-white font-medium disabled:opacity-50"
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Evaluate Explanation'
                  )}
                </button>
              </>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {transcription && (
            <div className="bg-gray-50 border border-gray-200 p-4 rounded">
              <h3 className="font-semibold mb-2">Transcription:</h3>
              <p className="text-sm text-gray-700">{transcription}</p>
            </div>
          )}

          {evaluation && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{evaluation.clarity}%</div>
                    <div className="text-sm text-gray-500">Clarity</div>
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{evaluation.completeness}%</div>
                    <div className="text-sm text-gray-500">Completeness</div>
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{evaluation.organization}%</div>
                    <div className="text-sm text-gray-500">Organization</div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
                <div className="space-y-2">
                  <div className="font-semibold">Overall Score: {evaluation.overallScore}%</div>
                  <div className="space-y-1">
                    {evaluation.feedback.map((feedback, index) => (
                      <div key={index} className="text-sm">• {feedback}</div>
                    ))}
                  </div>
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