export interface DeliveryClient {
  phone: string;
  name: string;
}

export interface DeliveryLocation {
  long: number;
  lat: number;
}

export interface DeliveryCreateOrderInput {
  vendorOrderId: string;
  origin: {
    location: DeliveryLocation;
    address: string;
    client: DeliveryClient;
  };
  destination: {
    location: DeliveryLocation;
    address: string;
  };
}
