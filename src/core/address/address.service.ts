import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Address } from '@/shared/entities/address.entity';
import { User } from '@/shared/entities/user.entity';
import { CreateAddressRequest } from '@/core/address/dto/create-address-request.dto';

@Injectable()
export class AddressService {
  constructor(@InjectRepository(Address) private readonly addressRepo: Repository<Address>) {}

  listForUser(userId: string) {
    return this.addressRepo.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  create(userId: string, data: CreateAddressRequest) {
    const address = this.addressRepo.create({
      user: { id: userId } as User,
      name: data.name,
      long: data.long,
      lat: data.lat,
    });

    return this.addressRepo.save(address);
  }

  async remove(userId: string, addressId: string) {
    const address = await this.addressRepo.findOne({
      where: { id: addressId, user: { id: userId } },
    });

    if (!address) {
      throw new NotFoundException('Manzil topilmadi');
    }

    await this.addressRepo.remove(address);

    return { message: "Manzil o'chirildi" };
  }
}
