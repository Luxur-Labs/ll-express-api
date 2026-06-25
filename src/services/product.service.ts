import { prisma } from '../utils/prisma';
import { createUserStampFields, updateUserStampFields, userStampInclude } from '../utils/userStamps';

export interface CreateProductData {
  name: string;
  code?: string;
  warranty?: string;
  onPaperRate?: number;
  price: number;
  discount?: number;
}

export interface UpdateProductData {
  name?: string;
  code?: string;
  warranty?: string;
  onPaperRate?: number | null;
  price?: number;
  discount?: number;
}

export class ProductService {
  async createProduct(data: CreateProductData, actorUserId?: string) {
    return await prisma.product.create({
      data: {
        name: data.name,
        code: data.code,
        warranty: data.warranty,
        onPaperRate: data.onPaperRate ?? null,
        price: data.price,
        discount: data.discount || 0,
        ...createUserStampFields(actorUserId),
      },
      include: userStampInclude,
    });
  }

  async getProductById(id: string) {
    return await prisma.product.findUnique({
      where: { id },
      include: userStampInclude,
    });
  }

  async getAllProducts() {
    return await prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      include: userStampInclude,
    });
  }

  async updateProduct(id: string, data: UpdateProductData, actorUserId?: string) {
    const updateData: any = { ...updateUserStampFields(actorUserId) };
    
    if (data.name !== undefined) updateData.name = data.name;
    if (data.code !== undefined) updateData.code = data.code;
    if (data.warranty !== undefined) updateData.warranty = data.warranty;
    if (data.onPaperRate !== undefined) updateData.onPaperRate = data.onPaperRate;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.discount !== undefined) updateData.discount = data.discount;

    return await prisma.product.update({
      where: { id },
      data: updateData,
      include: userStampInclude,
    });
  }

  async deleteProduct(id: string) {
    return await prisma.product.delete({
      where: { id },
    });
  }


  async getProductsByPriceRange(minPrice: number, maxPrice: number) {
    return await prisma.product.findMany({
      where: {
        price: {
          gte: minPrice,
          lte: maxPrice,
        },
      },
      orderBy: { price: 'asc' },
    });
  }

  async getProductsList(page: number = 0, limit: number = 50, search?: string) {
    const safeLimit = Math.max(1, limit);
    const safePage = Math.max(0, page);
    const where: any = {};

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { code: { contains: term, mode: 'insensitive' } },
      ];
    }

    const total = await prisma.product.count({ where });
    const skip = safePage * safeLimit;

    if (skip >= total) {
      return {
        data: [],
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
        },
      };
    }

    const data = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        code: true,
        warranty: true,
        onPaperRate: true,
        price: true,
        discount: true,
        createdAt: true,
        updatedAt: true,
        createdBy: userStampInclude.createdBy,
        updatedBy: userStampInclude.updatedBy,
      },
      orderBy: { name: 'asc' },
      skip,
      take: safeLimit,
    });

    return {
      data,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
      },
    };
  }
}
