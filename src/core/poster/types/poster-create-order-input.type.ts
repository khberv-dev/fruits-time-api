export interface PosterCreateOrderInput {
  spotId: number;
  autoAccept: boolean;
  serviceMode: number;
  client: { id: number };
  products: { id: number; count: number; price?: number }[];
  delivery?: { courierId: number; deliveryPrice: number; processingStatus: number };
}
