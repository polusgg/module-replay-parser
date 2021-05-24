import { BaseRootPacket } from "@nodepolus/framework/src/protocol/packets/root/baseRootPacket";
import { SetGameOption } from "@polusgg/plugin-polusgg-api/src/packets/root/setGameOption";
import { MessageReader } from "@nodepolus/framework/src/util/hazelMessage";
import { Buffer } from "buffer/";
import { RootPacket } from "@nodepolus/framework/src/protocol/packets/hazel";

export type Player = {
  id: number;
  name: string;
  cosmetics: Cosmetic[];
};

export type Packet<Parsed extends boolean> = {
  direction: "toServer" | "toClient";
  contents: Parsed extends true ? BaseRootPacket : MessageReader;
};

export type Replay<PacketParsing extends boolean> = {
  version: number;
  players: Player[];
  gameOptions: SetGameOption[];
  packets: Packet<PacketParsing>[];
};

export enum CosmeticType {
  PlayerColor,
}

export type Cosmetic = {
  type: CosmeticType.PlayerColor;
  color: [number, number, number, number];
};

export enum GameOptionType {
  NumberValue,
  BooleanValue,
  EnumValue,
}

export function parsePacket<Parsed extends boolean>(reader: MessageReader, parsed: Parsed): Packet<Parsed> {
  const packet: Partial<Packet<Parsed>> = {
    direction: reader.readBoolean() ? "toClient" : "toServer",
  };

  packet.contents = (parsed ? RootPacket.deserialize(reader, packet.direction === "toClient") : reader.readMessage()) as Parsed extends true ? BaseRootPacket : MessageReader;

  return packet as Packet<Parsed>;
}

export function parseCosmetic(reader: MessageReader): Cosmetic {
  const type = reader.readByte() as CosmeticType;

  switch (type) {
    case CosmeticType.PlayerColor:
      return {
        type,
        color: [
          reader.readByte(),
          reader.readByte(),
          reader.readByte(),
          reader.readByte(),
        ],
      };
  }
}

export function parsePlayer(reader: MessageReader): Player {
  const player: Partial<Player> = {
    id: reader.readByte(),
    name: reader.readString(),
  };

  player.cosmetics = new Array(reader.readByte());

  for (let i = 0; i < player.cosmetics.length; i++) {
    player.cosmetics[i] = parseCosmetic(reader);
  }

  return player as Player;
}

export function parseFile<PacketParsing extends boolean>(arrayBuffer: ArrayBuffer, { parsePackets }: { parsePackets: PacketParsing }): Replay<PacketParsing> {
  const reader = new MessageReader(0);

  // monkey patch the reader for browser support
  //@ts-ignore
  reader.buffer = Buffer.from(arrayBuffer);

  const replay: Partial<Replay<PacketParsing>> = {
    version: reader.readUInt32(),
  };

  replay.players = new Array(reader.readByte());

  for (let i = 0; i < replay.players.length; i++) {
    replay.players[i] = parsePlayer(reader);
  }

  replay.gameOptions = new Array(reader.readByte());

  for (let i = 0; i < replay.gameOptions.length; i++) {
    replay.gameOptions[i] = SetGameOption.deserialize(reader.readMessage()!);
  }

  replay.packets = new Array(reader.readUInt32());

  for (let i = 0; i < replay.packets.length; i++) {
    replay.packets[i] = parsePacket(reader, parsePackets);
  }

  return replay as Replay<PacketParsing>;
}
