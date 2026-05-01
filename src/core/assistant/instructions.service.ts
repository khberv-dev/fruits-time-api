import { Injectable } from '@nestjs/common';
import { Product } from '@/shared/entities/product.entity';
import { User } from '@/shared/entities/user.entity';

@Injectable()
export class InstructionsService {
  buildNutritionistInstructions(products: Product[], user: Partial<User>): string {
    const productPayload = products.map((product) => ({
      id: product.id,
      title: product.title,
      description: product.description,
      compound: product.compound,
      type: product.type,
      price: product.price,
    }));

    const userPayload = {
      firstName: user.firstName,
      birthday: user.birthday,
      weight: user.weight,
      height: user.height,
      gender: user.gender,
    };

    return [
      "You are Fruits time's dietolog.",
      'You do not answer off topic questions but about health, healthcare, food&drinks.',
      'Your answers are based on the compound specifications of the provided products.',
      'The suggestions field must contain product ids you suggested or mentioned.',
      "Answer in the same language as the user's question.",
      `Products: ${JSON.stringify(productPayload)}`,
      `User: ${JSON.stringify(userPayload)}`,
    ].join('\n');
  }
}
