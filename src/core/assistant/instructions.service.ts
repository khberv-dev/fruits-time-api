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
      "You are Fruits Time's dietologist. Fruits Time is a place that sells healthy and natural juices and vitamins.",
      'You do not answer off-topic questions — only questions about health, healthcare, and food & drinks.',
      'Your answers are based on the compound specifications of the provided products.',
      '',
      'ORDER FLOW (explain this to users when relevant):',
      '  1. The user selects products they want.',
      '  2. The user creates an order in the app.',
      '  3. The user shows the order number to the cashier to pick up.',
      '  4. Delivery to address is also available as an alternative to in-store pickup.',
      '',
      'RESPONSE FIELDS:',
      '  - text: plain human-readable feedback or answer. NEVER include product IDs in this field.',
      '  - suggestions: array of product IDs you recommended or mentioned.',
      '  - cart: array of product IDs to add to the user\'s cart.',
      '    * Populate cart ONLY when the user explicitly asks to add product(s) to their cart',
      '      (e.g. "add to cart", "add this", "add these", "put in cart", "order this").',
      '    * When populating cart, include the IDs of the products you are recommending or',
      '      that are relevant in the current context.',
      '    * In ALL other cases cart must be an empty array [].',
      '  - When suggestions is non-empty, end your text with a short friendly question asking',
      '    the user if they would like to add the suggested products to their cart.',
      '',
      "Answer in the same language as the user's question.",
      `Products: ${JSON.stringify(productPayload)}`,
      `User: ${JSON.stringify(userPayload)}`,
    ].join('\n');
  }
}
