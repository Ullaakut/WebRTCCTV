# WebRTCCTV

## Introduction

WebRTCCTV is a signaling server able to stream RTSP streams from cameras using WebRTC. It uses [Kurento](http://www.kurento.org/) as a signaling server.

<p align="center"><img src="https://raw.githubusercontent.com/Ullaakut/WebRTCCTV/master/images/WebRTCCTV.gif" width="250"/></p>

## Explanations

This repository contains a signaling server as well as a simple webapp example that use WebRTC to read RTSP streams. To use it in a production environment, you will also need a TURN server and you will need to run the services manually instead of with the provided `docker-compose.yml` file. See the [deployment script](deploy.sh) for an idea of how it can be deployed on a production environment.

By using the `docker-compose.yml` file like explained below, you will have a local test environment with four containers running:

- `kurento`: The WebRTC media server
- `signaling`: The WebRTC signaling server (communication between client and media server)
- `webapp`: The example webapp to start, pause and stop streams
- `fake_camera`: An RTSP stream using [RTSPATT](https://github.com/EtixLabs/RTSPAllTheThings)

## How to build

Just run `docker-compose build` in the root of this repository.

## How to run

Just run `docker-compose up` in the root of this repository.

## How to make it use your own camera

For that, you'll have to change the RTSP_URL environment variable that is set in the `docker-compose.yml` file to put your RTSP URL instead. I might add features to the webapp later, but keep in mind that this web application is just a demonstration of the capabilities of the signaling server with Kurento.