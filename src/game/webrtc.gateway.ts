import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from '../auth/ws-jwt.guard';
import { SOCKET_EVENTS } from '../shared/types/socket-events.types';
import {
  WebRTCAnswerPayload,
  WebRTCIceCandidatePayload,
  WebRTCOfferPayload,
} from '../shared/types/socket-events.types';

/**
 * Pure relay gateway for WebRTC signaling.
 * The server never inspects or processes the SDP/ICE data —
 * it just forwards signals between the two peers.
 */
@WebSocketGateway({
  cors: { origin: '*', credentials: false },
  namespace: '/webrtc',
})
export class WebRTCGateway {
  @WebSocketServer()
  server: Server;

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.WEBRTC_OFFER)
  handleOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: WebRTCOfferPayload,
  ) {
    this.server.to(payload.targetSocketId).emit(SOCKET_EVENTS.WEBRTC_OFFER, {
      fromSocketId: client.id,
      offer: payload.offer,
    });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.WEBRTC_ANSWER)
  handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: WebRTCAnswerPayload,
  ) {
    this.server.to(payload.targetSocketId).emit(SOCKET_EVENTS.WEBRTC_ANSWER, {
      fromSocketId: client.id,
      answer: payload.answer,
    });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE)
  handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: WebRTCIceCandidatePayload,
  ) {
    this.server.to(payload.targetSocketId).emit(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, {
      fromSocketId: client.id,
      candidate: payload.candidate,
    });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.WEBRTC_LEAVE)
  handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string },
  ) {
    // Notify all peers in the room that this peer is leaving voice
    client.to(payload.roomId).emit(SOCKET_EVENTS.WEBRTC_LEAVE, {
      fromSocketId: client.id,
    });
  }
}
