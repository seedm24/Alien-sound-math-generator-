#!/usr/bin/env node

const { program } = require('commander');
const { createAudioContext, createOscillator, createGain, createDelay, createConvolver } = require('web-audio-api');

class AlienSoundGenerator {
  constructor() {
    this.audioContext = createAudioContext();
    this.masterGain = this.audioContext.createGain();
    this.delay = this.audioContext.createDelay(5.0);
    this.reverb = this.audioContext.createConvolver();

    this.masterGain.connect(this.delay);
    this.delay.connect(this.reverb);
    this.reverb.connect(this.audioContext.destination);

    this.setupReverb();
  }

  setupReverb() {
    const impulseLength = 2 * this.audioContext.sampleRate;
    const impulse = this.audioContext.createBuffer(2, impulseLength, this.audioContext.sampleRate);
    const impulseL = impulse.getChannelData(0);
    const impulseR = impulse.getChannelData(1);
    for (let i = 0; i < impulseLength; i++) {
      impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / impulseLength, 2);
      impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / impulseLength, 2);
    }
    this.reverb.buffer = impulse;
  }

  generateCustomWaveform(formula) {
    const sampleRate = this.audioContext.sampleRate;
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

    return this.audioContext.createPeriodicWave(realCoefficients, imagCoefficients);
  }

  generateSound(options) {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    const customWave = this.generateCustomWaveform(options.formula);
    if (customWave) {
      oscillator.setPeriodicWave(customWave);
    } else {
      oscillator.type = 'sine';
    }

    oscillator.frequency.setValueAtTime(options.frequency, this.audioContext.currentTime);
    oscillator.detune.setValueAtTime(options.detune, this.audioContext.currentTime);
    gainNode.gain.setValueAtTime(options.volume, this.audioContext.currentTime);

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);

    this.applyEnvelope(gainNode, options.envelope);

    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
      oscillator.disconnect();
      gainNode.disconnect();
    }, options.duration * 1000);
  }

  applyEnvelope(gainNode, envelope) {
    const now = this.audioContext.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(1, now + envelope.attack);
    gainNode.gain.linearRampToValueAtTime(envelope.sustain, now + envelope.attack + envelope.decay);
    gainNode.gain.setValueAtTime(envelope.sustain, now + envelope.duration - envelope.release);
    gainNode.gain.linearRampToValueAtTime(0, now + envelope.duration);
  }

  setEffects(reverbLevel, delayTime) {
    this.masterGain.gain.setValueAtTime(reverbLevel, this.audioContext.currentTime);
    this.delay.delayTime.setValueAtTime(delayTime, this.audioContext.currentTime);
  }
}

const generator = new AlienSoundGenerator();

program
  .version('0.1.0')
  .description('Alien Sound Generator CLI');

program
  .command('generate')
  .description('Generate an alien sound')
  .option('-f, --formula <formula>', 'Waveform formula', 'Math.sin(2 * Math.PI * t)')
  .option('-v, --volume <volume>', 'Volume (0-1)', parseFloat, 0.5)
  .option('-q, --frequency <frequency>', 'Frequency in Hz', parseFloat, 220)
  .option('-d, --detune <detune>', 'Detune in cents', parseInt, 0)
  .option('-t, --duration <duration>', 'Duration in seconds', parseFloat, 2)
  .option('-a, --attack <attack>', 'Envelope attack time', parseFloat, 0.1)
  .option('-c, --decay <decay>', 'Envelope decay time', parseFloat, 0.2)
  .option('-s, --sustain <sustain>', 'Envelope sustain level', parseFloat, 0.7)
  .option('-r, --release <release>', 'Envelope release time', parseFloat, 0.5)
  .option('-rv, --reverb <reverb>', 'Reverb level (0-1)', parseFloat, 0.5)
  .option('-dl, --delay <delay>', 'Delay time in seconds', parseFloat, 0.3)
  .action((options) => {
    generator.setEffects(options.reverb, options.delay);
    generator.generateSound({
      formula: options.formula,
      volume: options.volume,
      frequency: options.frequency,
      detune: options.detune,
      duration: options.duration,
      envelope: {
        attack: options.attack,
        decay: options.decay,
        sustain: options.sustain,
        release: options.release,
        duration: options.duration
      }
    });
    console.log('Generating alien sound...');
    setTimeout(() => process.exit(), options.duration * 1000 + 100);
  });

program.parse(process.argv);