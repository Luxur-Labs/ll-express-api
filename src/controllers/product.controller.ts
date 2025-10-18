import { Request, Response } from 'express';
import { ProductService, CreateProductData, UpdateProductData } from '../services/product.service';

const productService = new ProductService();

export async function createProductController(req: Request, res: Response) {
  try {
    const { product, warranty, price, discount } = req.body;

    if (!product || !warranty || price === undefined) {
      return res.status(400).json({
        message: 'product, warranty, and price are required'
      });
    }

    if (typeof price !== 'number' || price < 0) {
      return res.status(400).json({
        message: 'Price must be a valid positive number'
      });
    }

    if (discount !== undefined && (typeof discount !== 'number' || discount < 0 || discount > 100)) {
      return res.status(400).json({
        message: 'Discount must be a valid number between 0 and 100'
      });
    }

    const productData: CreateProductData = {
      product,
      warranty,
      price,
      discount,
    };

    const createdProduct = await productService.createProduct(productData);
    return res.status(201).json(createdProduct);
  } catch (error) {
    console.error('Error creating product:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getProductByIdController(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    const product = await productService.getProductById(id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    return res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getAllProductsController(req: Request, res: Response) {
  try {
    const products = await productService.getAllProducts();
    return res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function updateProductController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { product, warranty, price, discount } = req.body;

    if (!id) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    // Check if product exists
    const existingProduct = await productService.getProductById(id);
    if (!existingProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Validate price if provided
    if (price !== undefined && (typeof price !== 'number' || price < 0)) {
      return res.status(400).json({
        message: 'Price must be a valid positive number'
      });
    }

    // Validate discount if provided
    if (discount !== undefined && (typeof discount !== 'number' || discount < 0 || discount > 100)) {
      return res.status(400).json({
        message: 'Discount must be a valid number between 0 and 100'
      });
    }

    const updateData: UpdateProductData = {};
    if (product !== undefined) updateData.product = product;
    if (warranty !== undefined) updateData.warranty = warranty;
    if (price !== undefined) updateData.price = price;
    if (discount !== undefined) updateData.discount = discount;

    const updatedProduct = await productService.updateProduct(id, updateData);
    return res.json(updatedProduct);
  } catch (error) {
    console.error('Error updating product:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function deleteProductController(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    // Check if product exists
    const existingProduct = await productService.getProductById(id);
    if (!existingProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await productService.deleteProduct(id);
    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting product:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}


export async function getProductsByPriceRangeController(req: Request, res: Response) {
  try {
    const { minPrice, maxPrice } = req.query;

    if (!minPrice || !maxPrice) {
      return res.status(400).json({ message: 'minPrice and maxPrice are required' });
    }

    const min = parseFloat(minPrice as string);
    const max = parseFloat(maxPrice as string);

    if (isNaN(min) || isNaN(max) || min < 0 || max < 0 || min > max) {
      return res.status(400).json({
        message: 'minPrice and maxPrice must be valid positive numbers, and minPrice must be less than or equal to maxPrice'
      });
    }

    const products = await productService.getProductsByPriceRange(min, max);
    return res.json(products);
  } catch (error) {
    console.error('Error fetching products by price range:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getProductsListController(req: Request, res: Response) {
  try {
    const products = await productService.getProductsList();
    return res.json(products);
  } catch (error) {
    console.error('Error fetching products list:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
