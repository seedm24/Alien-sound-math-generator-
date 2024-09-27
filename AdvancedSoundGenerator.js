import React, { useState, useEffect, useRef } from 'react';

const AdvancedSoundGenerator = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [oscillators, setOscillators] = useState([
    { formula: 'Math.sin(2 * Math.PI * t)', volume: 0.5, detune: 0 },
    { formula: 'Math.sin(4 * Math.PI * t)', volume: 0.3, detune: 0 },
  ]);
  const [envelope, setEnvelope] = useState({ attack: 0.1, decay: 0.2, sustain: 0.7, release: 0.5 });
  const [effects, setEffects] = useState({ reverb: 0.5, delay: 0.3 });
  const [lfo, setLfo] = useState({ frequency: 1, amplitude: 10 });

  const audioContextRef = useRef(null);
  const oscillatorNodesRef = useRef([]);
  const gainNodesRef = useRef([]);
  const masterGainNodeRef = useRef(null);
  const reverbNodeRef = useRef(null);
  const delayNodeRef = useRef(null);
  const lfoNodeRef = useRef(null);
  const lfoStartedRef = useRef(false);

  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    masterGainNodeRef.current = audioContextRef.current.createGain();
    reverbNodeRef.current = audioContextRef.current.createConvolver();
    delayNodeRef.current = audioContextRef.current.createDelay(5.0);
    lfoNodeRef.current = audioContextRef.current.createOscillator();

    masterGainNodeRef.current.connect(delayNodeRef.current);
    delayNodeRef.current.connect(reverbNodeRef.current);
    reverbNodeRef.current.connect(audioContextRef.current.destination);

    const impulseLength = 2 * audioContextRef.current.sampleRate;
    const impulse = audioContextRef.current.createBuffer(2, impulseLength, audioContextRef.current.sampleRate);
    const impulseL = impulse.getChannelData(0);
    const impulseR = impulse.getChannelData(1);
    for (let i = 0; i < impulseLength; i++) {
      impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / impulseLength, 2);
      impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / impulseLength, 2);
    }
    reverbNodeRef.current.buffer = impulse;

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const generateCustomWaveform = (formula) => {
    const sampleRate = audioContextRef.current.sampleRate;
    const length = sampleRate;
    const realCoefficients = new Float32Array(length);
    const imagCoefficients = new Float32Array(length);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      try {
        realCoefficients[i] = eval(formula);
      } catch (error) {
        console.error('Error evaluating formula:', error);
        return null;
      }
    }

    return audioContextRef.current.createPeriodicWave(realCoefficients, imagCoefficients);
  };

  const applyEnvelope = (gainNode, startTime) => {
    const { attack, decay, sustain, release } = envelope;
    const now = audioContextRef.current.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(1, now + attack);
    gainNode.gain.linearRampToValueAtTime(sustain, now + attack + decay);
    gainNode.gain.setValueAtTime(sustain, now + startTime - release);
    gainNode.gain.linearRampToValueAtTime(0, now + startTime);
  };

  const generateSound = () => {
    if (!audioContextRef.current) return;

    oscillatorNodesRef.current = oscillators.map((osc) => {
      const oscillator = audioContextRef.current.createOscillator();
      const gainNode = audioContextRef.current.createGain();
      const customWave = generateCustomWaveform(osc.formula);

      if (customWave) {
        oscillator.setPeriodicWave(customWave);
      } else {
        oscillator.type = 'sine';
      }

      oscillator.frequency.setValueAtTime(220, audioContextRef.current.currentTime);
      oscillator.detune.setValueAtTime(osc.detune, audioContextRef.current.currentTime);
      gainNode.gain.setValueAtTime(osc.volume, audioContextRef.current.currentTime);

      oscillator.connect(gainNode);
      gainNode.connect(masterGainNodeRef.current);

      applyEnvelope(gainNode, 2); // 2 second note duration

      oscillator.start();
      gainNodesRef.current.push(gainNode);

      return oscillator;
    });

    // Set up LFO
    if (!lfoStartedRef.current) {
      lfoNodeRef.current.frequency.setValueAtTime(lfo.frequency, audioContextRef.current.currentTime);
      lfoNodeRef.current.start();
      lfoStartedRef.current = true;
    } else {
      lfoNodeRef.current.frequency.setValueAtTime(lfo.frequency, audioContextRef.current.currentTime);
    }
    const lfoGain = audioContextRef.current.createGain();
    lfoGain.gain.setValueAtTime(lfo.amplitude, audioContextRef.current.currentTime);
    lfoNodeRef.current.connect(lfoGain);
    oscillatorNodesRef.current.forEach((osc) => {
      lfoGain.connect(osc.frequency);
    });

    // Set effect parameters
    delayNodeRef.current.delayTime.setValueAtTime(effects.delay, audioContextRef.current.currentTime);
    masterGainNodeRef.current.gain.setValueAtTime(effects.reverb, audioContextRef.current.currentTime);

    setIsPlaying(true);

    // Stop the sound after 2 seconds
    setTimeout(stopSound, 2000);
  };

  const stopSound = () => {
    oscillatorNodesRef.current.forEach((osc) => {
      osc.stop();
      osc.disconnect();
    });
    gainNodesRef.current.forEach((gain) => {
      gain.disconnect();
    });
    oscillatorNodesRef.current = [];
    gainNodesRef.current = [];

    // Don't stop the LFO, just disconnect it
    if (lfoNodeRef.current) {
      lfoNodeRef.current.disconnect();
    }

    setIsPlaying(false);
  };

  const updateOscillator = (index, field, value) => {
    const newOscillators = [...oscillators];
    newOscillators[index][field] = value;
    setOscillators(newOscillators);
  };

  const updateEnvelope = (field, value) => {
    setEnvelope({ ...envelope, [field]: parseFloat(value) });
  };

  const updateEffects = (field, value) => {
    setEffects({ ...effects, [field]: parseFloat(value) });
  };

  const updateLFO = (field, value) => {
    setLfo({ ...lfo, [field]: parseFloat(value) });
  };

  return (
    <div className="soundGenerator">
      <h2 className="sectionTitle">Oscillators</h2>
      {oscillators.map((osc, index) => (
        <div key={index} className="oscillatorContainer">
          <input
            type="text"
            value={osc.formula}
            onChange={(e) => updateOscillator(index, 'formula', e.target.value)}
            className="inputField"
            placeholder="Oscillator formula"
          />
          <div className="sliderContainer">
            <label>Volume</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={osc.volume}
              onChange={(e) => updateOscillator(index, 'volume', parseFloat(e.target.value))}
              className="slider"
            />
          </div>
          <div className="sliderContainer">
            <label>Detune</label>
            <input
              type="range"
              min="-100"
              max="100"
              step="1"
              value={osc.detune}
              onChange={(e) => updateOscillator(index, 'detune', parseInt(e.target.value))}
              className="slider"
            />
          </div>
        </div>
      ))}

      <h2 className="sectionTitle">Envelope</h2>
      {Object.entries(envelope).map(([param, value]) => (
        <div key={param} className="sliderContainer">
          <label>{param}</label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.01"
            value={value}
            onChange={(e) => updateEnvelope(param, e.target.value)}
            className="slider"
          />
        </div>
      ))}

      <h2 className="sectionTitle">Effects</h2>
      {Object.entries(effects).map(([effect, value]) => (
        <div key={effect} className="sliderContainer">
          <label>{effect}</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={value}
            onChange={(e) => updateEffects(effect, e.target.value)}
            className="slider"
          />
        </div>
      ))}

      <h2 className="sectionTitle">LFO</h2>
      <div className="sliderContainer">
        <label>Frequency</label>
        <input
          type="range"
          min="0"
          max="20"
          step="0.1"
          value={lfo.frequency}
          onChange={(e) => updateLFO('frequency', e.target.value)}
          className="slider"
        />
      </div>
      <div className="sliderContainer">
        <label>Amplitude</label>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={lfo.amplitude}
          onChange={(e) => updateLFO('amplitude', e.target.value)}
          className="slider"
        />
      </div>

      <button 
        onClick={isPlaying ? stopSound : generateSound}
        className="button"
      >
        {isPlaying ? 'Stop Sound' : 'Generate Sound'}
      </button>
    </div>
  );
};

export default AdvancedSoundGenerator;