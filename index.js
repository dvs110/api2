
const express = require('express');
const app = express();
const http = require('http').createServer(app); //create sever
const io = require('socket.io')(http);//Socket.IO instance created and attached to the HTTP server
const record = require('node-record-lpcm16');//used to record audio
const { PassThrough } = require('stream');//used to stream audio
const dotenv = require("dotenv")
dotenv.config();
const sampleRate = 16000;
const channels = 2;//refers to the number of audio channels in an audio signal
const bitDepth = 16;// refers to the number of bits of information in each audio sample. 

let micStream = null;
let micData = null;
let filteredData = null;
let totalSquared = 0;
let samples = 0;
const PORT = process.env.PORT || 4000;
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {//connection to socket


    micStream = record.record({
        sampleRate: sampleRate,
        channels: channels,
        bitDepth: bitDepth
    });
    //micStream is a stream created using the record-lpcm16 library in Node.js. The record function of this library is used to create a new micStream object that will record audio from the microphone using the specified sample rate, number of channels, and bit depth.

    micData = new PassThrough();

    // micData, on the other hand, is a PassThrough stream that is created to receive the raw audio data produced by micStream. It is also a readable stream that produces raw audio data, but it does not modify the data in any way. It simply passes the data along to the next stream in the pipeline, which in this case is filteredData.


    micStream.stream().pipe(micData);
    // micStream.stream() returns a readable stream that produces the raw audio data from micStream.
    // .pipe() is a method that connects two streams together and allows data to flow from the source stream to the destination stream.
    // micData is a writable stream that receives the raw audio data produced by micStream.stream() and passes it along to the next stream in the pipeline, which is filteredData.

    filteredData = new PassThrough();


    //     filteredData receives the raw audio data and processes it in some way. In this case, it simply passes the data along to the next stream in the pipeline, which is the event listener for the 'data' event.


    micData.on('data', (data) => {
        filteredData.write(data);
    });
    // The write() method of the filteredData stream writes the raw audio data to the stream, which is then available for further processing by downstream streams in the pipeline. In this case, the downstream stream is the event listener for the 'data' event of the filteredData stream, which processes the data to calculate the noise level.

    let intervalId = null;
    filteredData.on('data', (data) => {
        const length = data.length / 2;
        // Each audio sample is represented by two bytes (since the bitDepth is 16), so the total number of audio samples in the data stream is data.length / 2.
        for (let i = 0; i < length; i++) {
            const value = data.readInt16LE(i * 2);//
            totalSquared += value ** 2;
            samples += 1;
        }
        const averageSquared = totalSquared / samples;
        const rms = Math.sqrt(averageSquared);
        const decibels = 20 * Math.log10(rms / 32768);
        console.log('Noise level:', decibels.toFixed(2), 'dB');
        socket.emit('noiseLevel', decibels.toFixed(2));//firing custom event



    });

    socket.on('disconnect', () => {
        clearInterval(intervalId);
        micStream.stop();
        micStream = null;
        micData = null;
        filteredData = null;
        totalSquared = 0;
        samples = 0;
    });
});

http.listen(PORT, () => {
    console.log('listening on *:3000');
});

