-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "key" TEXT;

-- Rattache les rayons par défaut déjà créés à leur clé (d'après leur nom d'origine)
UPDATE "Category" SET "key" = CASE "name"
  WHEN 'Fruits & légumes' THEN 'produce' WHEN 'Fruit & veg' THEN 'produce'
  WHEN 'Boucherie' THEN 'butcher' WHEN 'Meat' THEN 'butcher'
  WHEN 'Poissonnerie' THEN 'fish' WHEN 'Fish' THEN 'fish'
  WHEN 'Crèmerie' THEN 'dairy' WHEN 'Dairy' THEN 'dairy'
  WHEN 'Boulangerie' THEN 'bakery' WHEN 'Bakery' THEN 'bakery'
  WHEN 'Épicerie' THEN 'grocery' WHEN 'Pantry' THEN 'grocery'
  WHEN 'Sucré' THEN 'sweet' WHEN 'Sweets' THEN 'sweet'
  WHEN 'Boissons' THEN 'drinks' WHEN 'Drinks' THEN 'drinks'
  WHEN 'Surgelés' THEN 'frozen' WHEN 'Frozen' THEN 'frozen'
  WHEN 'Hygiène' THEN 'hygiene' WHEN 'Personal care' THEN 'hygiene'
  WHEN 'Entretien' THEN 'cleaning' WHEN 'Household' THEN 'cleaning'
  WHEN 'Bébé' THEN 'baby' WHEN 'Baby' THEN 'baby'
  WHEN 'Animaux' THEN 'pets' WHEN 'Pets' THEN 'pets'
  WHEN 'Divers' THEN 'other' WHEN 'Other' THEN 'other'
END
WHERE "key" IS NULL;
