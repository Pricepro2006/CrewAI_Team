/**
 * Walmart Grocery List Component
 * Manages grocery lists with smart features like meal planning, recurring items, and sharing
 */

import React, { useState, useEffect } from 'react';
import {
  ListChecks,
  Plus,
  Edit2,
  Trash2,
  Share2,
  Copy,
  Calendar,
  Clock,
  ShoppingCart,
  CheckCircle2,
  Circle,
  Search,
  Filter,
  ChevronRight,
  ChevronDown,
  Users,
  Package,
  DollarSign,
  Repeat,
  Star,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import { Checkbox } from '../../../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import { Textarea } from '../../../components/ui/textarea';
import { useGroceryStore } from '../../store/groceryStore';
import { useCart } from '../../hooks/useCart';
import { formatPrice } from '../../lib/utils';
import { cn } from '../../lib/utils';
import type { GroceryList, GroceryItem, WalmartProduct } from '../../../types/walmart-grocery';

interface WalmartGroceryListProps {
  onSelectList?: (list: GroceryList) => void;
  onAddToCart?: (items: GroceryItem[]) => void;
  showCreateButton?: boolean;
  compactMode?: boolean;
}

interface ListItemRowProps {
  item: GroceryItem;
  onTogglePurchased: (itemId: string) => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
  onAddToCart?: (item: GroceryItem) => void;
  compactMode?: boolean;
}

const ListItemRow: React.FC<ListItemRowProps> = ({
  item,
  onTogglePurchased,
  onUpdateQuantity,
  onRemove,
  onAddToCart,
  compactMode = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [quantity, setQuantity] = useState(item.quantity);

  const handleQuantitySubmit = () => {
    if (quantity !== item.quantity && quantity > 0) {
      onUpdateQuantity(item.id, quantity);
    }
    setIsEditing(false);
  };

  if (compactMode) {
    return (
      <div className={cn(
        "flex items-center gap-2 py-2",
        item.isPurchased && "opacity-50"
      )}>
        <Checkbox
          checked={item.isPurchased}
          onCheckedChange={() => onTogglePurchased(item.id)}
        />
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-sm truncate",
            item.isPurchased && "line-through"
          )}>
            {item.product?.name || item.notes}
          </p>
        </div>
        <span className="text-sm text-muted-foreground">
          {item.quantity}x
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={() => onRemove(item.id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn(
      "group flex items-start gap-3 py-3",
      item.isPurchased && "opacity-60"
    )}>
      <Checkbox
        checked={item.isPurchased}
        onCheckedChange={() => onTogglePurchased(item.id)}
        className="mt-1"
      />
      
      <div className="flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className={cn(
              "font-medium",
              item.isPurchased && "line-through"
            )}>
              {item.product?.name || item.notes}
            </p>
            {item.product && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {item.product.brand && <span>{item.product.brand}</span>}
                {item.product.size && <span>• {item.product.size}</span>}
                {item.product.price && (
                  <span>• {formatPrice(item.product.price)}</span>
                )}
              </div>
            )}
            {item.notes && item.product && (
              <p className="text-sm text-muted-foreground italic">{item.notes}</p>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {isEditing ? (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  className="w-16 h-8"
                  min={1}
                  max={99}
                  onBlur={handleQuantitySubmit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleQuantitySubmit();
                    if (e.key === 'Escape') {
                      setQuantity(item.quantity);
                      setIsEditing(false);
                    }
                  }}
                  autoFocus
                />
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => setIsEditing(true)}
              >
                {item.quantity}x
              </Button>
            )}
            
            {item.product && onAddToCart && !item.isPurchased && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onAddToCart(item)}
              >
                <ShoppingCart className="h-4 w-4" />
              </Button>
            )}
            
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onRemove(item.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {item.product?.category && (
          <Badge variant="outline" className="text-xs">
            {item.product.category}
          </Badge>
        )}
      </div>
    </div>
  );
};

export const WalmartGroceryList: React.FC<WalmartGroceryListProps> = ({
  onSelectList,
  onAddToCart,
  showCreateButton = true,
  compactMode = false,
}) => {
  const {
    lists,
    currentListId,
    createList,
    updateList,
    deleteList,
    setCurrentList,
    removeFromList,
  } = useGroceryStore();
  
  const { addItem } = useCart();
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [editingList, setEditingList] = useState<GroceryList | null>(null);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'items'>('date');

  const currentList = lists.find((list: GroceryList) => list.id === currentListId);

  const handleCreateList = () => {
    if (newListName.trim()) {
      const list = createList(newListName.trim(), newListDescription.trim());
      setCurrentList(list.id);
      setNewListName('');
      setNewListDescription('');
      setShowCreateDialog(false);
      onSelectList?.(list);
    }
  };

  const handleEditList = () => {
    if (editingList && newListName.trim()) {
      updateList(editingList.id, {
        name: newListName.trim(),
        description: newListDescription.trim(),
      });
      setShowEditDialog(false);
      setEditingList(null);
    }
  };

  const handleDeleteList = (listId: string) => {
    deleteList(listId);
    if (currentListId === listId && lists.length > 1) {
      const nextList = lists.find((l: GroceryList) => l.id !== listId);
      if (nextList) setCurrentList(nextList.id);
    }
  };

  const handleTogglePurchased = (listId: string, itemId: string) => {
    const list = lists.find((l: GroceryList) => l.id === listId);
    if (list) {
      const updatedItems = list.items.map((item: GroceryItem) =>
        item.id === itemId ? { ...item, isPurchased: !item.isPurchased } : item
      );
      updateList(listId, { items: updatedItems });
    }
  };

  const handleUpdateQuantity = (listId: string, itemId: string, quantity: number) => {
    const list = lists.find((l: GroceryList) => l.id === listId);
    if (list) {
      const updatedItems = list.items.map((item: GroceryItem) =>
        item.id === itemId ? { ...item, quantity } : item
      );
      updateList(listId, { items: updatedItems });
    }
  };

  const handleAddItemToCart = async (item: GroceryItem) => {
    if (item.product) {
      await addItem(item.product, item.quantity);
    }
  };

  const handleAddAllToCart = (list: GroceryList) => {
    const unpurchasedItems = list.items.filter(item => !item.isPurchased && item.product);
    if (onAddToCart) {
      onAddToCart(unpurchasedItems);
    } else {
      unpurchasedItems.forEach(item => {
        if (item.product) {
          addItem(item.product, item.quantity);
        }
      });
    }
  };

  const handleDuplicateList = (list: GroceryList) => {
    const newList = createList(
      `${list.name} (Copy)`,
      list.description
    );
    // Copy items to new list
    const newItems = list.items.map(item => ({
      ...item,
      id: `item-${Date.now()}-${Math.random()}`,
      listId: newList.id,
      isPurchased: false,
    }));
    updateList(newList.id, { items: newItems });
  };

  // Filter and sort lists
  const filteredLists = lists
    .filter((list: GroceryList) => {
      if (searchQuery) {
        return list.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
               (list.description?.toLowerCase().includes(searchQuery.toLowerCase()));
      }
      return true;
    })
    .sort((a: GroceryList, b: GroceryList) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'items':
          return b.items.length - a.items.length;
        case 'date':
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

  if (compactMode && currentList) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <ListChecks className="h-5 w-5" />
              {currentList.name}
            </CardTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Edit2 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleAddAllToCart(currentList)}>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Add All to Cart
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDuplicateList(currentList)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate List
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => handleDeleteList(currentList.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete List
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="space-y-1">
            {currentList.items.map(item => (
              <ListItemRow
                key={item.id}
                item={item}
                onTogglePurchased={(itemId) => handleTogglePurchased(currentList.id, itemId)}
                onUpdateQuantity={(itemId, qty) => handleUpdateQuantity(currentList.id, itemId, qty)}
                onRemove={(itemId) => removeFromList(currentList.id, itemId)}
                compactMode
              />
            ))}
          </div>
        </CardContent>
        <CardFooter className="pt-3">
          <div className="w-full flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {currentList.items.filter(i => i.isPurchased).length}/{currentList.items.length} completed
            </span>
            <span className="font-medium">
              {formatPrice(currentList.totalEstimate)}
            </span>
          </div>
        </CardFooter>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header Controls */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search lists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <div className="flex gap-2">
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Recent</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="items">Items</SelectItem>
              </SelectContent>
            </Select>
            
            {showCreateButton && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New List
              </Button>
            )}
          </div>
        </div>

        {/* Lists Grid */}
        {filteredLists.length === 0 ? (
          <Card className="p-12 text-center">
            <ListChecks className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No grocery lists yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first list to start organizing your shopping
            </p>
            {showCreateButton && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create List
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLists.map(list => {
              const completedCount = list.items.filter(i => i.isPurchased).length;
              const progress = list.items.length > 0 ? (completedCount / list.items.length) * 100 : 0;
              
              return (
                <Card
                  key={list.id}
                  className={cn(
                    "cursor-pointer hover:shadow-lg transition-shadow",
                    currentListId === list.id && "ring-2 ring-primary"
                  )}
                  onClick={() => {
                    setCurrentList(list.id);
                    onSelectList?.(list);
                  }}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{list.name}</CardTitle>
                        {list.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {list.description}
                          </p>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingList(list);
                              setNewListName(list.name);
                              setNewListDescription(list.description || '');
                              setShowEditDialog(true);
                            }}
                          >
                            <Edit2 className="h-4 w-4 mr-2" />
                            Edit List
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateList(list);
                            }}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingList(list);
                              setShowShareDialog(true);
                            }}
                          >
                            <Share2 className="h-4 w-4 mr-2" />
                            Share
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteList(list.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-3">
                      {/* Stats */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Package className="h-4 w-4" />
                          {list.items.length} items
                        </span>
                        <span className="flex items-center gap-1 font-medium">
                          <DollarSign className="h-4 w-4" />
                          {formatPrice(list.totalEstimate)}
                        </span>
                      </div>
                      
                      {/* Progress */}
                      {list.items.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              {completedCount} of {list.items.length} completed
                            </span>
                            <span className="font-medium">{Math.round(progress)}%</span>
                          </div>
                          <div className="h-2 bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                      
                      {/* Preview Items */}
                      {list.items.length > 0 && (
                        <div className="space-y-1">
                          {list.items.slice(0, 3).map((item: GroceryItem) => (
                            <div
                              key={item.id}
                              className={cn(
                                "flex items-center gap-2 text-sm",
                                item.isPurchased && "opacity-50"
                              )}
                            >
                              {item.isPurchased ? (
                                <CheckCircle2 className="h-3 w-3 text-green-600" />
                              ) : (
                                <Circle className="h-3 w-3" />
                              )}
                              <span className={cn(
                                "truncate",
                                item.isPurchased && "line-through"
                              )}>
                                {item.product?.name || item.notes}
                              </span>
                            </div>
                          ))}
                          {list.items.length > 3 && (
                            <p className="text-xs text-muted-foreground">
                              +{list.items.length - 3} more items
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                  
                  <CardFooter className="pt-0">
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddAllToCart(list);
                      }}
                      disabled={list.items.filter((i: GroceryItem) => !i.isPurchased && i.product).length === 0}
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Add All to Cart
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create List Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New List</DialogTitle>
            <DialogDescription>
              Give your grocery list a name and optional description
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="list-name">List Name</Label>
              <Input
                id="list-name"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="e.g., Weekly Groceries"
              />
            </div>
            <div>
              <Label htmlFor="list-description">Description (Optional)</Label>
              <Textarea
                id="list-description"
                value={newListDescription}
                onChange={(e) => setNewListDescription(e.target.value)}
                placeholder="e.g., Regular items for the week"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateList} disabled={!newListName.trim()}>
              Create List
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit List Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit List</DialogTitle>
            <DialogDescription>
              Update your list details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-list-name">List Name</Label>
              <Input
                id="edit-list-name"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="edit-list-description">Description (Optional)</Label>
              <Textarea
                id="edit-list-description"
                value={newListDescription}
                onChange={(e) => setNewListDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditList} disabled={!newListName.trim()}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share List Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share List</DialogTitle>
            <DialogDescription>
              Share "{editingList?.name}" with family or friends
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-secondary p-4 rounded-lg">
              <p className="text-sm font-medium mb-2">Share Link</p>
              <div className="flex gap-2">
                <Input
                  value={`https://walmart.groceries.app/list/${editingList?.id}`}
                  readOnly
                />
                <Button
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `https://walmart.groceries.app/list/${editingList?.id}`
                    );
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Anyone with this link can view and edit the list</span>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowShareDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};