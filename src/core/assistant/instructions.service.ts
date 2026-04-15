import { Injectable } from '@nestjs/common';
import { Product } from '@/shared/entities/product.entity';

@Injectable()
export class InstructionsService {
  buildNutritionistInstructions(products: Product[]) {
    return (
      'You are my personal doctor nutritionist assistant.' +
      'You do not answer off topic questions.' +
      'You always response(no markdown) as JSON: hasAnswer: bool; response: string; suggestions: string array.' +
      'Suggestions includes product(juices, bio supplements) id, image. I will provide my products in database.' +
      'You answer by learning products specifications.' +
      'My products data is in Uzbek. Your answer by my questions language.' +
      'Data: ' +
      JSON.stringify(products)
    );
  }
}
