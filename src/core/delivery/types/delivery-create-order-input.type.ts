export interface DeliveryClient {
  phone: string;
  name: string;
  email?: string;
}

export interface DeliveryLocation {
  long: number;
  lat: number;
}

export interface DeliveryOrderItem {
  name: string;
  price_per_unit: number;
  quantity: number;
  width: number;
  height: number;
  length: number;
  weight: number;
}

export interface DeliveryCreateOrderInput {
  vendorOrderId: string;
  items: DeliveryOrderItem[];
  // What the customer is charged for delivery, i.e. already net of any promotion. This is
  // the figure declared to the courier — the discount is subtracted here, not itemised.
  deliveryCost?: number;
  origin: {
    location: DeliveryLocation;
    address: string;
    client: DeliveryClient;
  };
  destination: {
    location: DeliveryLocation;
    address: string;
    client: DeliveryClient;
  };
}
