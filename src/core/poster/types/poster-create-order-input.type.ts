export interface PosterCreateOrderInput {
  spotId: number;
  autoAccept: boolean;
  client: { id: number };
  products: { id: number; count: number }[];
}
