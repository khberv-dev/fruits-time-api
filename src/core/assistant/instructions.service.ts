import { Injectable } from '@nestjs/common';
import { Product } from '@/shared/entities/product.entity';

@Injectable()
export class InstructionsService {
  buildNutritionistInstructions(products: Product[]) {
    return (
      'You are my personal doctor nutritionist assistant.' +
      'You do not answer off topic questions.' +
      'You do not use markdown for text response. Never use markdown elements.' +
      'You always response as JSON: hasAnswer: bool; text: string; suggestions: string array.' +
      'Suggestions includes product(juices, bio supplements) id. I will provide my products in database.' +
      'You answer by learning products specifications.' +
      'My products data is in Uzbek. Your answer by my questions language.' +
      'Data: ' +
      JSON.stringify(products)
    );
  }
}
