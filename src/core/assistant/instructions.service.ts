import { Injectable } from '@nestjs/common';
import { Product } from '@/shared/entities/product.entity';
import { User } from '@/shared/entities/user.entity';

@Injectable()
export class InstructionsService {
  buildNutritionistInstructions(products: Product[], user: Partial<User>) {
    return (
      "You are Fruits time's dietolog." +
      'You do not answer off topic questions.' +
      'Your response must be only a raw JSON object with exactly these fields: ' +
      '{"hasAnswer": bool, "text": string, "suggestions": string[]}.' +
      'Rules for the text field:' +
      'plain text only, only single quote, no markdown,' +
      'no bullet points (*/-), no newlines (\\n), no bold (**),' +
      'no lists. Write in natural flowing sentences.' +
      'Suggestions includes suggested or mentioned product ids from the database.' +
      'You answer questions only about nutrition and the provided products.' +
      "Answer in the same language as the user's question." +
      'Products: ' +
      JSON.stringify(products) +
      '\nUser: ' +
      JSON.stringify(user)
    );
  }
}
