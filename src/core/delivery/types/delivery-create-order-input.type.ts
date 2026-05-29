export interface DeliveryClient {
  phone: string;
  name: string;
}

export interface DeliveryLocation {
  long: number;
  lat: number;
}

export interface DeliveryOrderItem {
  name: string;
  price_per_unit: number;
  quantity: number;
}

export interface DeliveryCreateOrderInput {
  vendorOrderId: string;
  items: DeliveryOrderItem[];
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
