import { Client, type Room } from "@colyseus/sdk";
import { NightState, ROOM_NAME } from "@phare/shared";

export type NightRoom = Room<any, NightState>;

// Le client Colyseus passe par le proxy de Vite (/colyseus), sur la même adresse que la page.
// Ainsi, il marche aussi bien sur localhost que depuis un autre PC du réseau local.
const client = new Client(`${location.origin}/colyseus`);

export function createNight(name: string): Promise<NightRoom> {
  return client.create(ROOM_NAME, { name }, NightState);
}

export function joinNight(code: string, name: string): Promise<NightRoom> {
  return client.joinById(code, { name }, NightState);
}
